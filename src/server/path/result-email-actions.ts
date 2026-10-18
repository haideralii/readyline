"use server";
/**
 * "Email me my result" (REQ-031 FR-1; D-2881 to D-2885, D-2893; SR-1 to
 * SR-4): the address typed on the result page is used for one send and kept
 * nowhere; the answers are re-validated and the result re-derived as the page
 * derives it; the limiter runs on the address's hash first, then the IP's;
 * the message is the result and nothing else; the provider leaves the one
 * audit line (`email.sent`, `result:<hash>`, the owner's account when signed
 * in). No row, no cookie; the log carries the template and eight characters
 * of the hash.
 */
import { headers } from "next/headers";
import { z } from "zod";
import { deriveChecklist } from "@/lib/checklist/derive";
import { contactEmail } from "@/lib/legal/config";
import { log } from "@/lib/logging/logger";
import {
  RESULT_EMAIL_LIMITS,
  resultEmailAddressKey,
  resultEmailIpKey,
} from "@/lib/path/result-email";
import { emailHash } from "@/lib/peppered-hash";
import { buildResult } from "@/lib/questionnaire/result";
import { answersSchemaFor } from "@/lib/questionnaire/schema";
import { ANSWERS_VERSION } from "@/lib/questionnaire/steps";
import { hashAddress } from "@/lib/registers/auditor-link";
import { siteUrl } from "@/lib/site";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { parseInput, strictObject } from "@/lib/validation";
import {
  RESULT_EMAIL_ANSWERS_INVALID,
  RESULT_EMAIL_HOUR,
  RESULT_EMAIL_INVALID,
  RESULT_EMAIL_IP_HOUR,
  RESULT_EMAIL_NOT_SENT,
  RESULT_EMAIL_SENT,
} from "@/app/start/_components/steps/result-copy";
import { loadServerDraft } from "@/server/accounts/actions";
import { getViewer } from "@/server/accounts/queries";
import { clientIp } from "@/server/auth/paths";
import { hitRateLimit } from "@/server/auth/rate-limit";
import { MemoryRateLimiter } from "@/lib/ops/health";
import { SupabaseEnvError } from "@/server/supabase/env";
import { createEmailProvider } from "@/server/email/provider";
import { resultEmail } from "@/server/email/templates";

export type SendResultEmailResponse =
  | { ok: true; message: string }
  | { ok: false; message: string; limited?: true };

const Address = z.string().trim().toLowerCase().email().max(254);

// Without a database (no Supabase variables: the public e2e job, a local run) the
// limiter is this instance's memory with the same limits, as the derive action's is.
const memoryAddress = new MemoryRateLimiter(
  RESULT_EMAIL_LIMITS.perAddress.limit,
  RESULT_EMAIL_LIMITS.perAddress.windowSeconds * 1000,
);
const memoryIp = new MemoryRateLimiter(
  RESULT_EMAIL_LIMITS.perIp.limit,
  RESULT_EMAIL_LIMITS.perIp.windowSeconds * 1000,
);
async function allowed(
  key: string,
  limit: { limit: number; windowSeconds: number },
  memory: MemoryRateLimiter,
): Promise<boolean> {
  try {
    return await hitRateLimit(key, limit);
  } catch (e) {
    if (e instanceof SupabaseEnvError) return memory.allow(key);
    throw e;
  }
}

export async function sendResultEmailAction(
  input: unknown,
): Promise<SendResultEmailResponse> {
  const viewer = await getViewer();
  const signedIn = Boolean(viewer?.account && !viewer.deleted);
  // SR-4: the address and, signed out, the answers; a signed-in owner's answers
  // come from the server draft, so a body carrying them is refused.
  const Input = strictObject({
    email: Address,
    answers: z.unknown().optional(),
  });
  const parsed = parseInput(Input, input);
  if (!parsed.ok) return { ok: false, message: RESULT_EMAIL_INVALID };
  if (signedIn && parsed.data.answers !== undefined)
    return { ok: false, message: RESULT_EMAIL_INVALID };
  const address = parsed.data.email;

  const dataset = getStandardsDataset();
  const schema = answersSchemaFor(
    new Set(dataset.registrationGroups.map((g) => g.code)),
  );
  const draft = signedIn ? await loadServerDraft() : null;
  const answersInput = signedIn
    ? draft
      ? { answersVersion: ANSWERS_VERSION, ...draft.answers }
      : null
    : parsed.data.answers;
  const answers =
    answersInput === null ? null : parseInput(schema, answersInput);
  if (!answers || !answers.ok)
    return { ok: false, message: RESULT_EMAIL_ANSWERS_INVALID };
  const outcome = buildResult(dataset, answers.data);
  if (!outcome.ok) return { ok: false, message: RESULT_EMAIL_ANSWERS_INVALID };

  // D-2883, question 2 (a): the address bucket first, then the connection's.
  const hashed = emailHash(address);
  if (
    !(await allowed(
      resultEmailAddressKey(hashed),
      RESULT_EMAIL_LIMITS.perAddress,
      memoryAddress,
    ))
  )
    return { ok: false, limited: true, message: RESULT_EMAIL_HOUR };
  const ip = clientIp(await headers());
  if (
    ip &&
    !(await allowed(
      resultEmailIpKey(hashAddress(ip)),
      RESULT_EMAIL_LIMITS.perIp,
      memoryIp,
    ))
  )
    return { ok: false, limited: true, message: RESULT_EMAIL_IP_HOUR };

  const message = resultEmail({
    to: address,
    result: outcome.result,
    checklistTotal: deriveChecklist(outcome.result, answers.data, dataset)
      .total,
    signedIn,
    origin: siteUrl(),
    today: new Date(),
    contact: contactEmail(),
    accountId: signedIn ? (viewer?.account?.id ?? null) : null,
  });
  try {
    await createEmailProvider().send(message);
  } catch (e) {
    log.warn("result-email.send-failed", {
      name: e instanceof Error ? e.name : "unknown",
      hashPrefix: hashed.slice(0, 8),
    });
    return { ok: false, message: RESULT_EMAIL_NOT_SENT };
  }
  log.info("result-email.sent", {
    template: message.template,
    hashPrefix: hashed.slice(0, 8),
    signedIn,
  });
  return { ok: true, message: RESULT_EMAIL_SENT(address) };
}
