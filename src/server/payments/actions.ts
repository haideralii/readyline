"use server";
/**
 * The Buy action (REQ-007 FR-2, SR-3, SR-4). Order of checks: signed in with
 * an account, questionnaire complete, rate limit (5 per hour per account,
 * one database statement), then one Checkout Session created server-side and
 * a redirect to Stripe. The customer never sees the price id or the key, and
 * the amount is the Price's, never a value from the browser.
 */
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { z } from "zod";
import { log } from "@/lib/logging/logger";
import {
  buildSubscriptionCheckoutParams,
  safeCancelPath,
} from "@/lib/payments/checkout-params";
import { FAKE_CHECKOUT_PATH } from "@/lib/payments/fake-session";
import { hasActiveSubscription } from "@/server/registers/queries";
import { getSubscription } from "@/server/payments/subscription-queries";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { PROMPT_VERSION } from "@/lib/generator/prompts";
import { ANSWERS_VERSION, answersSchemaFor } from "@/lib/questionnaire/schema";
import { buildResult } from "@/lib/questionnaire/result";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { parseInput, strictObject } from "@/lib/validation";
import { loadServerDraft } from "@/server/accounts/actions";
import { getViewer } from "@/server/accounts/queries";
import { checkCheckoutAllowed } from "@/server/auth/rate-limit";
import { answersHash } from "@/server/generation/run";
import { createCheckoutSession, type CheckoutClient } from "./checkout";
import { FakeCheckoutClient } from "./fake";
import { createStripeClient, readStripeEnv, StripeEnvError } from "./stripe";

const Input = strictObject({ cancelPath: z.string().max(64).optional() });

// A "use server" module may export only async functions; the messages and
// the result type live in ./messages.ts.
import {
  CHECKOUT_FAILED,
  CHECKOUT_NEEDS_ANSWERS,
  CHECKOUT_RATE_LIMITED,
  CHECKOUT_UNAVAILABLE,
  PORTAL_UNAVAILABLE,
  SUBSCRIPTION_ALREADY_ACTIVE,
  SUBSCRIPTION_UNAVAILABLE,
  stripeFailureFields,
  type CheckoutActionResult,
} from "./messages";

export async function createCheckoutAction(
  input: unknown,
): Promise<CheckoutActionResult> {
  const parsed = parseInput(Input, input ?? {});
  const cancelPath = safeCancelPath(
    parsed.ok ? parsed.data.cancelPath : undefined,
  );
  const viewer = await getViewer();
  if (!viewer) redirect(`/sign-in?next=${encodeURIComponent(cancelPath)}`);
  if (viewer.deleted) redirect("/account/deleted");
  if (!viewer.account) redirect("/account/setup");
  const account = viewer.account;

  const draft = await loadServerDraft();
  const dataset = getStandardsDataset();
  const schema = answersSchemaFor(
    new Set(dataset.registrationGroups.map((g) => g.code)),
  );
  const answers = draft
    ? schema.safeParse({ answersVersion: ANSWERS_VERSION, ...draft.answers })
    : null;
  if (!answers || !answers.success)
    return { ok: false, message: CHECKOUT_NEEDS_ANSWERS };
  const built = buildResult(dataset, answers.data);
  if (!built.ok) return { ok: false, message: built.message };

  let env;
  try {
    env = readStripeEnv();
  } catch (e) {
    if (e instanceof StripeEnvError)
      return { ok: false, message: CHECKOUT_UNAVAILABLE };
    throw e;
  }
  if (!(await checkCheckoutAllowed(account.id))) {
    log.warn("payments.checkout.rate-limited", { accountId: account.id });
    return { ok: false, message: CHECKOUT_RATE_LIMITED };
  }

  const assessmentId = `${ANSWERS_VERSION}:${answersHash(answers.data)}`;
  let session;
  try {
    session = await createCheckoutSession({
      // Fake mode (D-709): a page on our own origin stands in for Checkout.
      stripe: env.fake
        ? new FakeCheckoutClient(env.webhookSecret)
        : createStripeClient(env.secretKey),
      checkout: {
        priceId: env.pricePack,
        accountId: account.id,
        email: viewer.user.email ?? "",
        assessmentId,
        packVersion: PROMPT_VERSION,
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
        cancelPath,
      },
      // One session per account and answers snapshot per hour: a double click or a retry reuses it.
      idempotencyKey: `checkout:${account.id}:${assessmentId}:${Math.floor(Date.now() / 3_600_000)}`,
    });
  } catch (e) {
    // Batch 23 item 2: a Stripe failure (wrong key, missing Price, outage) is a
    // message on the page, never Next's error page; the code is logged, not the key.
    log.error("payments.checkout.failed", {
      accountId: account.id,
      ...stripeFailureFields(e),
    });
    return { ok: false, message: CHECKOUT_FAILED };
  }
  log.info("payments.checkout.created", {
    accountId: account.id,
    sessionId: session.id,
  });
  redirect(session.url);
}

/**
 * REQ-009 Session C: start the registers subscription. Signed-in owner, no
 * questionnaire needed, the same hourly checkout limit, a subscription-mode
 * session on the recurring Price (no trial, no fee), and a redirect. If the
 * account already holds an active subscription entitlement the button does
 * nothing but say so.
 */
export async function createSubscriptionAction(
  input: unknown,
): Promise<CheckoutActionResult> {
  const parsed = parseInput(Input, input ?? {});
  const cancelPath = safeCancelPath(
    parsed.ok ? parsed.data.cancelPath : undefined,
  );
  const viewer = await getViewer();
  if (!viewer) redirect(`/sign-in?next=${encodeURIComponent(cancelPath)}`);
  if (viewer.deleted) redirect("/account/deleted");
  if (!viewer.account) redirect("/account/setup");
  const account = viewer.account;

  let env;
  try {
    env = readStripeEnv();
  } catch (e) {
    if (e instanceof StripeEnvError)
      return { ok: false, message: SUBSCRIPTION_UNAVAILABLE };
    throw e;
  }
  if (!env.priceRegisters)
    return { ok: false, message: SUBSCRIPTION_UNAVAILABLE };
  const supabase = await createSupabaseServerClient();
  if (await hasActiveSubscription(supabase, account.id))
    return { ok: false, message: SUBSCRIPTION_ALREADY_ACTIVE };
  if (!(await checkCheckoutAllowed(account.id))) {
    log.warn("payments.subscription.rate-limited", { accountId: account.id });
    return { ok: false, message: CHECKOUT_RATE_LIMITED };
  }
  let session;
  try {
    const stripe: CheckoutClient = env.fake
      ? new FakeCheckoutClient(env.webhookSecret)
      : createStripeClient(env.secretKey);
    const params = buildSubscriptionCheckoutParams({
      priceId: env.priceRegisters,
      accountId: account.id,
      email: viewer.user.email ?? "",
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
      cancelPath,
    });
    const created = await stripe.checkout.sessions.create(params, {
      idempotencyKey: `subscribe:${account.id}:${Math.floor(Date.now() / 3_600_000)}`,
    });
    if (!created.url) throw new Error("Checkout session has no URL");
    session = { id: created.id, url: created.url };
  } catch (e) {
    log.error("payments.subscription.failed", {
      accountId: account.id,
      ...stripeFailureFields(e),
    });
    return { ok: false, message: CHECKOUT_FAILED };
  }
  log.info("payments.subscription.checkout-created", {
    accountId: account.id,
    sessionId: session.id,
  });
  redirect(session.url);
}

export async function subscribeAction(
  _previous: CheckoutActionResult | null,
  formData: FormData,
): Promise<CheckoutActionResult | null> {
  const cancelPath = formData.get("cancelPath");
  return createSubscriptionAction(
    typeof cancelPath === "string" ? { cancelPath } : {},
  );
}

/**
 * The Stripe Billing portal (REQ-009 Session C, PO answer 4): cancel, change
 * the card, see invoices. Opens for the customer behind the account's
 * subscription; in fake mode the fake page stands in.
 */
export async function billingPortalAction(
  _previous: CheckoutActionResult | null,
  _formData: FormData,
): Promise<CheckoutActionResult | null> {
  void _previous;
  void _formData;
  void parseInput(strictObject({}), {});
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=%2Faccount");
  if (viewer.deleted) redirect("/account/deleted");
  if (!viewer.account) redirect("/account/setup");
  const supabase = await createSupabaseServerClient();
  const sub = await getSubscription(supabase, viewer.account.id);
  if (!sub?.stripe_customer_id)
    return { ok: false, message: PORTAL_UNAVAILABLE };
  let env;
  try {
    env = readStripeEnv();
  } catch (e) {
    if (e instanceof StripeEnvError)
      return { ok: false, message: PORTAL_UNAVAILABLE };
    throw e;
  }
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  if (env.fake)
    redirect(
      `${site}${FAKE_CHECKOUT_PATH}/${sub.fake_session_id ?? ""}?portal=1`,
    );
  try {
    const portal = await createStripeClient(
      env.secretKey,
    ).billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${site}/account`,
    });
    log.info("payments.portal.opened", { accountId: viewer.account.id });
    redirect(portal.url);
  } catch (e) {
    if (isRedirectError(e)) throw e;
    log.error("payments.portal.failed", {
      accountId: viewer.account.id,
      ...stripeFailureFields(e),
    });
    return { ok: false, message: PORTAL_UNAVAILABLE };
  }
}

/**
 * The Buy form's action (FR-2, FR-6): works with JavaScript off because it is
 * a plain form post; with it on, `useActionState` shows the message when the
 * checkout could not start. A successful call never returns (it redirects).
 */
export async function buyAction(
  _previous: CheckoutActionResult | null,
  formData: FormData,
): Promise<CheckoutActionResult | null> {
  const cancelPath = formData.get("cancelPath");
  return createCheckoutAction(
    typeof cancelPath === "string" ? { cancelPath } : {},
  );
}
