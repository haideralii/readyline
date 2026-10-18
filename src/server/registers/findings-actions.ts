"use server";
/**
 * The findings register's entry (REQ-033 FR-1, FR-2, FR-5, SR-1 to SR-3;
 * D-2930, D-2931, D-2935): a pasted report or an uploaded PDF or Word file
 * is read in this request into candidate findings and forgotten (the log
 * carries counts, never words); a save runs every row through the register's
 * schema, whose participant gate refuses a flagged row with the detector's
 * own message, writes the finding with its reference, the improvement row
 * that carries the corrective action, the trail and the audit lines.
 */
import { z } from "zod";
import { log } from "@/lib/logging/logger";
import {
  FINDING_SEVERITIES,
  type FindingSeverity,
} from "@/lib/registers/audit-day-types";
import { FindingForm, standardName } from "@/lib/registers/findings";
import {
  findingCandidates,
  type FindingCandidate,
} from "@/lib/registers/findings-parse";
import { plainDatabaseMessage } from "@/lib/registers/messages";
import { addMonths } from "@/lib/registers/status";
import { parseInput, strictObject, text } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import { checkRegisterWriteAllowed } from "@/server/auth/rate-limit";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { todaySydney } from "@/server/registers/worker-onboarding";
import {
  FINDINGS_FILE_MAX_BYTES,
  REPORT_REFUSALS,
  textFromReport,
} from "./findings-text";

export type ParseFindingsResult =
  | {
      ok: true;
      candidates: FindingCandidate[];
      source: "paste" | "pdf" | "docx";
      pages: number;
    }
  | { ok: false; message: string };

const SIGN_IN = "Sign in to use the registers.";
const LIMITED = "Too many changes in a minute. Wait a moment and try again.";

const PasteInput = strictObject({
  text: text(200_000, 1, "Paste the findings first"),
});

/** FR-1: the candidates in a pasted report or an uploaded file; nothing of the file is kept (D-2930). */
export async function parseFindingsAction(
  input: unknown,
): Promise<ParseFindingsResult> {
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted)
    return { ok: false, message: SIGN_IN };
  const accountId = viewer.account.id;
  if (input instanceof FormData) {
    const file = input.get("file");
    if (!(file instanceof File))
      return { ok: false, message: REPORT_REFUSALS.notAReport };
    if (file.size > FINDINGS_FILE_MAX_BYTES)
      return { ok: false, message: REPORT_REFUSALS.tooBig };
    const read = await textFromReport(new Uint8Array(await file.arrayBuffer()));
    if (!read.ok) return read;
    const candidates = findingCandidates(read.text);
    // D-2930: the count and the kind, never the words.
    log.info("findings.report.read", {
      accountId,
      kind: read.kind,
      pages: read.pages,
      bytes: file.size,
      candidates: candidates.length,
    });
    return { ok: true, candidates, source: read.kind, pages: read.pages };
  }
  const parsed = parseInput(PasteInput, input);
  if (!parsed.ok) return { ok: false, message: "Paste the findings first." };
  const candidates = findingCandidates(parsed.data.text);
  log.info("findings.paste.read", { accountId, candidates: candidates.length });
  return { ok: true, candidates, source: "paste", pages: 0 };
}

const RowInput = strictObject({
  standard_id: z.string().trim().max(120),
  indicator: z.string().max(500).default(""),
  severity: z.enum(FINDING_SEVERITIES),
  finding: z.string().max(2000),
  due_on: z.string().max(10).default(""),
});
const SaveInput = strictObject({ rows: z.array(RowInput).min(1).max(50) });

export type SaveFindingsResult =
  | {
      ok: true;
      saved: number;
      references: string[];
      /** The rows the gate or the schema refused, by their place in the list, with the message to show. */
      refused: { index: number; message: string }[];
    }
  | { ok: false; message: string };

const firstMessage = (errors: {
  fieldErrors: Record<string, string[]>;
  formErrors: string[];
}): string =>
  errors.fieldErrors.finding?.[0] ??
  Object.values(errors.fieldErrors).flat()[0] ??
  errors.formErrors[0] ??
  "Check the highlighted fields.";

/** FR-2, FR-5: saves the rows that pass the gate, each with its improvement row; the rest come back with the reason. */
export async function saveFindingsAction(
  input: unknown,
): Promise<SaveFindingsResult> {
  const parsed = parseInput(SaveInput, input);
  if (!parsed.ok)
    return { ok: false, message: "Check the highlighted fields." };
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted)
    return { ok: false, message: SIGN_IN };
  if (!(await checkRegisterWriteAllowed(viewer.user.id)))
    return { ok: false, message: LIMITED };
  const supabase = await createSupabaseServerClient();
  const accountId = viewer.account.id;
  const today = todaySydney();
  const references: string[] = [];
  const refused: { index: number; message: string }[] = [];
  for (const [index, row] of parsed.data.rows.entries()) {
    const checked = parseInput(FindingForm, {
      ...row,
      status: "open",
      addressed_on: "",
      addressed_by_role: "",
      verified_on: "",
    });
    if (!checked.ok) {
      refused.push({ index, message: firstMessage(checked) });
      continue;
    }
    const v = checked.data as {
      standard_id: string;
      indicator: string;
      severity: FindingSeverity;
      finding: string;
      due_on: string | null;
    };
    const ins = await supabase
      .from("findings")
      .insert({
        account_id: accountId,
        standard_id: v.standard_id,
        indicator: v.indicator,
        severity: v.severity,
        finding: v.finding,
        due_on: v.due_on,
        status: "open",
      })
      .select("id, reference")
      .single();
    if (ins.error) {
      refused.push({ index, message: plainDatabaseMessage(ins.error) });
      continue;
    }
    const id = ins.data.id as string;
    const reference = ins.data.reference as string;
    // FR-5 (D-2935): the corrective action's row, due on the auditor's date or three months out (the
    // Commission's follow-up horizon), linked both ways.
    const imp = await supabase
      .from("improvements")
      .insert({
        account_id: accountId,
        source_kind: "audit-finding",
        source_ref: reference,
        learned: v.finding,
        changed: `Corrective action for ${reference} (${standardName(v.standard_id)}): to be recorded here when it is done.`,
        owner_role: "Owner",
        due_on: v.due_on ?? addMonths(today, 3),
      })
      .select("id")
      .single();
    if (!imp.error) {
      await supabase
        .from("findings")
        .update({ improvement_id: imp.data.id as string })
        .eq("id", id)
        .eq("account_id", accountId);
      await supabase.from("register_events").insert({
        account_id: accountId,
        register: "improvements",
        row_id: imp.data.id as string,
        kind: "created",
        note: "",
      });
    }
    await supabase.from("register_events").insert({
      account_id: accountId,
      register: "findings",
      row_id: id,
      kind: "created",
      note: "",
    });
    await supabase.from("audit_log").insert({
      account_id: accountId,
      actor_user_id: viewer.user.id,
      action: "register.findings.created",
      target: id,
    });
    references.push(reference);
  }
  log.info("findings.saved", {
    accountId,
    saved: references.length,
    refused: refused.length,
  });
  return { ok: true, saved: references.length, references, refused };
}
