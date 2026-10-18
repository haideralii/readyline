"use server";
/**
 * REQ-035 FR-1 to FR-4, SR-1, SR-2, SR-4, SR-5 (D-2962 to D-2965): the gap
 * check. The owner's document is read in the request (pasted, or a PDF, Word
 * or text file through REQ-033's reader) and dropped; the whole text runs
 * through the participant detector before anything else; the hourly limiter
 * and, for a real model call, the daily quota are the cost controls; one
 * request to the model; the reply read against the outline; the list stored
 * as rows and nothing of the document; one audit line. The log carries the
 * type, the section count and the states, never a word of the text.
 */
import { countStates, parseGapReply } from "@/lib/gap-check/parse";
import { gapOutlineFor } from "@/lib/gap-check/outline";
import {
  GAP_CHECK_PROMPT_VERSION,
  gapCheckRequest,
} from "@/lib/gap-check/prompt";
import {
  GAP_CHECK_EMPTY,
  GAP_CHECK_LIMIT_MESSAGE,
  GAP_CHECK_REFUSED_LINE,
  GAP_CHECK_UNAVAILABLE,
} from "@/lib/gap-check/words";
import { createModelClient } from "@/lib/generator/model-client";
import { log } from "@/lib/logging/logger";
import { detectParticipantData } from "@/lib/privacy/participant-data";
import { plainDatabaseMessage } from "@/lib/registers/messages";
import { parseInput, strictObject, text } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import { checkGapCheckAllowed } from "@/server/auth/rate-limit";
import { QUOTA_MESSAGE } from "@/server/generation/policy";
import {
  FINDINGS_FILE_MAX_BYTES,
  REPORT_REFUSALS,
  textFromReport,
} from "@/server/registers/findings-text";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";

export type RunGapCheckResult =
  { ok: true; id: string } | { ok: false; message: string };

const SIGN_IN = "Sign in to check a document.";
const OWNER_ONLY = "Only the owner runs a check.";
const PICK_TYPE = "Pick which Readyline document yours stands for.";
const TITLE_MISSING = "Give your document a name.";
const TEXT_MAX = 400_000;

const Fields = strictObject({
  documentTypeId: text(120, 1, PICK_TYPE),
  title: text(120, 1, TITLE_MISSING),
  text: text(TEXT_MAX, 0, GAP_CHECK_EMPTY).optional(),
});

function fieldsOf(input: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of ["documentTypeId", "title", "text"]) {
    const v = input.get(key);
    if (typeof v === "string") out[key] = v;
  }
  return out;
}

export async function runGapCheckAction(
  input: unknown,
): Promise<RunGapCheckResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, message: SIGN_IN };
  if (!viewer.account || viewer.deleted)
    return { ok: false, message: OWNER_ONLY };
  const accountId = viewer.account.id;
  if (!(input instanceof FormData)) return { ok: false, message: PICK_TYPE };
  const parsed = parseInput(Fields, fieldsOf(input));
  if (!parsed.ok)
    return {
      ok: false,
      message:
        Object.values(parsed.fieldErrors).flat()[0] ??
        parsed.formErrors[0] ??
        PICK_TYPE,
    };
  const outline = gapOutlineFor(parsed.data.documentTypeId);
  if (!outline) return { ok: false, message: PICK_TYPE };

  // The text: the file in the request (SR-1, REQ-033's reader and caps), else the paste.
  let body = (parsed.data.text ?? "").trim();
  let source: "paste" | "pdf" | "docx" | "txt" = "paste";
  const file = input.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > FINDINGS_FILE_MAX_BYTES)
      return { ok: false, message: REPORT_REFUSALS.tooBig };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const read = await textFromReport(bytes);
    if (read.ok) {
      body = read.text.trim();
      source = read.kind;
    } else if (/\.txt$/i.test(file.name) || file.type === "text/plain") {
      body = new TextDecoder().decode(bytes).trim();
      source = "txt";
    } else return read;
  }
  if (!body) return { ok: false, message: GAP_CHECK_EMPTY };
  if (body.length > TEXT_MAX)
    return { ok: false, message: REPORT_REFUSALS.tooBig };

  // The gate on the whole text, before any request (FR-2, SR-2, D-2963). The provider's own
  // trading name is not a participant, so it is taken out of the text the detector reads.
  const tradingName = viewer.account.trading_name?.trim();
  const whole = `${parsed.data.title}\n${body}`;
  const found = detectParticipantData(
    tradingName ? whole.split(tradingName).join("the provider") : whole,
  );
  if (found.length > 0) {
    log.info("gap-check.refused", {
      accountId,
      documentTypeId: outline.typeId,
      rule: found[0].kind,
    });
    return {
      ok: false,
      message: `${found[0].message} ${GAP_CHECK_REFUSED_LINE}`,
    };
  }

  // The cost controls (SR-5): three an hour, and the daily quota when a model is really called.
  if (!(await checkGapCheckAllowed(accountId)))
    return { ok: false, message: GAP_CHECK_LIMIT_MESSAGE };
  const client = createModelClient();
  if (client.mode === "record") {
    const admin = createSupabaseAdminClient();
    const q = await admin.rpc("generation_quota_hit", { p_account: accountId });
    if (q.error) return { ok: false, message: GAP_CHECK_UNAVAILABLE };
    if (q.data === false) return { ok: false, message: QUOTA_MESSAGE };
  }

  let replyText: string;
  try {
    const reply = await client.complete(gapCheckRequest(outline, body), {
      documentTypeId: outline.typeId,
      sectionId: "gap-check",
    });
    replyText = reply.text;
    log.info("gap-check.replied", {
      accountId,
      documentTypeId: outline.typeId,
      inputTokens: reply.usage?.inputTokens ?? null,
      outputTokens: reply.usage?.outputTokens ?? null,
    });
  } catch (e) {
    log.warn("gap-check.unavailable", {
      accountId,
      documentTypeId: outline.typeId,
      reason: e instanceof Error ? e.name : "unknown",
    });
    return { ok: false, message: GAP_CHECK_UNAVAILABLE };
  }
  const sections = parseGapReply(replyText, outline, body);
  const counts = countStates(sections);

  const supabase = await createSupabaseServerClient();
  const check = await supabase
    .from("gap_checks")
    .insert({
      account_id: accountId,
      document_type_id: outline.typeId,
      title: parsed.data.title.trim(),
      covered: counts.covered,
      partly: counts.partly,
      missing: counts.missing,
      prompt_version: GAP_CHECK_PROMPT_VERSION,
    })
    .select("id")
    .single();
  if (check.error || !check.data)
    return {
      ok: false,
      message: check.error
        ? plainDatabaseMessage(check.error)
        : GAP_CHECK_UNAVAILABLE,
    };
  const id = check.data.id as string;
  const byId = new Map(outline.sections.map((s) => [s.id, s]));
  const rows = sections.map((s, position) => {
    const o = byId.get(s.sectionId)!;
    return {
      gap_check_id: id,
      account_id: accountId,
      section_id: s.sectionId,
      number: o.number,
      heading: o.heading,
      position,
      state: s.state,
      reason: s.reason,
      standard_ids: o.standardIds,
      indicator_labels: o.indicators.map((i) => i.label),
    };
  });
  const stored = await supabase.from("gap_check_sections").insert(rows);
  if (stored.error)
    return { ok: false, message: plainDatabaseMessage(stored.error) };
  await supabase.from("audit_log").insert({
    account_id: accountId,
    actor_user_id: viewer.user.id,
    action: "gap-check.ran",
    target: id,
  });
  // SR-1: the type, the source kind, the section count and the states; never the words.
  log.info("gap-check.ran", {
    accountId,
    documentTypeId: outline.typeId,
    source,
    sections: sections.length,
    covered: counts.covered,
    partly: counts.partly,
    missing: counts.missing,
  });
  return { ok: true, id };
}

const OpenedInput = strictObject({ id: text(36, 36, "id") });

/** SR-4: a result opened by someone other than the person who ran it. */
export async function noteGapCheckOpenedAction(
  input: unknown,
): Promise<{ ok: boolean }> {
  const parsed = parseInput(OpenedInput, input);
  if (!parsed.ok) return { ok: false };
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted) return { ok: false };
  const supabase = await createSupabaseServerClient();
  await supabase.from("audit_log").insert({
    account_id: viewer.account.id,
    actor_user_id: viewer.user.id,
    action: "gap-check.opened",
    target: parsed.data.id,
  });
  return { ok: true };
}
