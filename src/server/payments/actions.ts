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
import { createStripeClient, readStripeEnv, StripeEnvError } from "./stripe";

const Input = strictObject({ cancelPath: z.string().max(64).optional() });

export type CheckoutActionResult = { ok: false; message: string };

export const CHECKOUT_UNAVAILABLE =
  "Buying is not available in this environment yet.";
export const CHECKOUT_RATE_LIMITED =
  "You have started a few checkouts in the last hour. Give it an hour and try again, or email us at the contact address in the footer.";
export const CHECKOUT_NEEDS_ANSWERS =
  "Finish every step of the questionnaire first; the pack is drafted from those answers.";

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
  const session = await createCheckoutSession({
    stripe: createStripeClient(env.secretKey),
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
  log.info("payments.checkout.created", {
    accountId: account.id,
    sessionId: session.id,
  });
  redirect(session.url);
}
