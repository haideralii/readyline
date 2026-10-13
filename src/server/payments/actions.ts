"use server";
/**
 * The Buy action (REQ-007 FR-2, SR-3, SR-4). Order of checks: signed in with
 * an account, questionnaire complete, rate limit (5 per hour per account,
 * one database statement), then one Checkout Session created server-side and
 * a redirect to Stripe. The customer never sees the price id or the key, and
 * the amount is the Price's, never a value from the browser.
 */
import { redirect } from "next/navigation";
import { z } from "zod";
import { log } from "@/lib/logging/logger";
import { safeCancelPath } from "@/lib/payments/checkout-params";
import { PROMPT_VERSION } from "@/lib/generator/prompts";
import { ANSWERS_VERSION, answersSchemaFor } from "@/lib/questionnaire/schema";
import { buildResult } from "@/lib/questionnaire/result";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { parseInput, strictObject } from "@/lib/validation";
import { loadServerDraft } from "@/server/accounts/actions";
import { getViewer } from "@/server/accounts/queries";
import { checkCheckoutAllowed } from "@/server/auth/rate-limit";
import { answersHash } from "@/server/generation/run";
import { createCheckoutSession } from "./checkout";
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
