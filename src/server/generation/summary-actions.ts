"use server";
/**
 * The two ways out of "Summary to check" (REQ-033 Session C FR-C2; D-2978,
 * D-2982). "The summary is still right": the owner's record, a change-log
 * row with the day and the role written into the current version in place
 * (the .docx rendered again at its path), the state cleared, no new version
 * and no re-adoption (the Dev response's question 1 (a)). "Redraft the
 * summary": one model request through the redraft builder with the changed
 * section's new text as the context, the Year 6 gate, the same limiter and
 * quota as a section redraft, accepted into version n+1 with its change-log
 * row, unadopted, the state cleared. Readyline never clears the state on
 * its own and never sends the summary without the owner's click (D-2978).
 */
import { z } from "zod";
import {
  documentTypeById,
  readabilityGateFor,
  sectionsFor,
} from "@/lib/generator/catalogue";
import type { DocumentModel } from "@/lib/generator/document-model";
import { formatDateAu } from "@/lib/generator/fixed-text";
import { createModelClient } from "@/lib/generator/model-client";
import { requestHash } from "@/lib/generator/prompts";
import { DEFAULT_MODEL } from "@/lib/generator/recording-plan";
import {
  REDRAFT_REFUSED_MESSAGE,
  buildSummaryRedraftRequest,
  readRedraftReply,
  redraftModel,
} from "@/lib/generator/redraft";
import { renderDocx } from "@/lib/generator/render-docx";
import { log } from "@/lib/logging/logger";
import { sydneyDay } from "@/lib/metrics/counters";
import {
  REDRAFT_LIMITED,
  REDRAFT_UNAVAILABLE,
} from "@/lib/registers/findings-redraft";
import {
  SUMMARY_CONFIRM_AUDIT_ACTION,
  SUMMARY_NOTHING_TO_CHECK,
  SUMMARY_NOT_FOUND,
  SUMMARY_REDRAFT_AUDIT_ACTION,
  SUMMARY_SECTION_ID,
  changedSectionLabel,
  summaryConfirmChangeText,
  summaryRedraftChangeText,
} from "@/lib/registers/summary-check";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { parseInput, strictObject } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import {
  checkRedraftAllowed,
  checkRegisterWriteAllowed,
} from "@/server/auth/rate-limit";
import { QUOTA_MESSAGE } from "@/server/generation/policy";
import {
  getVersionSet,
  listDocumentVersions,
} from "@/server/generation/queries";
import { filledForRead, readFillInputs } from "@/server/generation/read-fill";
import { refreshSetSummary } from "@/server/generation/rerender";
import { DOCX_TYPE, documentStatus } from "@/server/generation/run";
import { objectPath } from "@/server/generation/storage";
import {
  SupabaseGenerationStore,
  type DocumentVersionRow,
} from "@/server/generation/store";
import { loadFacts } from "@/server/path/facts";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";

const SIGN_IN = "Sign in to work on your documents.";
const WRITE_LIMITED =
  "Too many changes in a minute. Wait a moment and try again.";

const Input = strictObject({
  setId: z.string().uuid(),
  typeId: z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/),
});

export type SummaryActionResult =
  { ok: true; version: number; href: string } | { ok: false; message: string };

function modelId(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

type Context = {
  accountId: string;
  userId: string;
  setId: string;
  type: NonNullable<ReturnType<typeof documentTypeById>>;
  latest: DocumentVersionRow;
  changed: { sectionId: string; number: string; heading: string; on: string };
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
};

/** The owner, the set, the newest version of the document and its open summary check, or the sentence that says why not. */
async function summaryContext(
  input: unknown,
): Promise<{ ok: true; ctx: Context } | { ok: false; message: string }> {
  const parsed = parseInput(Input, input);
  if (!parsed.ok) return { ok: false, message: SUMMARY_NOT_FOUND };
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted)
    return { ok: false, message: SIGN_IN };
  const supabase = await createSupabaseServerClient();
  const set = await getVersionSet(supabase, parsed.data.setId);
  if (!set || set.account_id !== viewer.account.id || set.status !== "ready")
    return { ok: false, message: SUMMARY_NOT_FOUND };
  const type = documentTypeById(parsed.data.typeId);
  if (!type) return { ok: false, message: SUMMARY_NOT_FOUND };
  const latest = (
    await listDocumentVersions(supabase, set.id, parsed.data.typeId)
  )[0];
  if (!latest) return { ok: false, message: SUMMARY_NOT_FOUND };
  if (!latest.summary_check_section_id || !latest.summary_check_on)
    return { ok: false, message: SUMMARY_NOTHING_TO_CHECK };
  return {
    ok: true,
    ctx: {
      accountId: viewer.account.id,
      userId: viewer.user.id,
      setId: set.id,
      type,
      latest,
      changed: {
        sectionId: latest.summary_check_section_id,
        ...changedSectionLabel(type.id, latest.summary_check_section_id),
        on: latest.summary_check_on,
      },
      supabase,
    },
  };
}

function tableRows(
  b: DocumentModel["sections"][number]["blocks"][number],
  f: (rows: string[][]) => string[][],
) {
  return b.type === "table" ? { ...b, rows: f(b.rows) } : b;
}

/**
 * FR-C2, "The summary is still right" (D-2978): the change-log row with the
 * day and the role in the current version, the file rendered again at the
 * same path, the state cleared; one audit line. No model, no new version.
 */
export async function confirmSummaryAction(
  input: unknown,
): Promise<SummaryActionResult> {
  const context = await summaryContext(input);
  if (!context.ok) return context;
  const { ctx } = context;
  if (!(await checkRegisterWriteAllowed(ctx.userId)))
    return { ok: false, message: WRITE_LIMITED };
  const facts = await loadFacts(ctx.supabase, ctx.accountId);
  const role = facts.role?.trim() || "Owner";
  const name = facts.name?.trim() || "";
  const today = sydneyDay();
  const model: DocumentModel = {
    ...ctx.latest.model,
    sections: ctx.latest.model.sections.map((s) =>
      s.id === "change-log"
        ? {
            ...s,
            blocks: s.blocks.map((b) =>
              tableRows(b, (rows) => [
                ...rows,
                [
                  ctx.latest.model.version,
                  formatDateAu(today),
                  summaryConfirmChangeText(ctx.changed.number),
                  name ? `${name}, ${role}` : role,
                ],
              ]),
            ),
          }
        : s,
    ),
  };
  const admin = createSupabaseAdminClient();
  const store = new SupabaseGenerationStore(admin);
  await store.putObject(
    ctx.latest.storage_path,
    new Uint8Array(await renderDocx(model)),
    DOCX_TYPE,
  );
  const updated = await admin
    .from("document_versions")
    .update({
      model,
      summary_check_section_id: null,
      summary_check_on: null,
    })
    .eq("id", ctx.latest.id)
    .eq("account_id", ctx.accountId);
  if (updated.error)
    return {
      ok: false,
      message: "The record could not be saved. Try again in a moment.",
    };
  await admin.from("audit_log").insert({
    account_id: ctx.accountId,
    actor_user_id: ctx.userId,
    action: SUMMARY_CONFIRM_AUDIT_ACTION,
    target: `${ctx.type.id}:${ctx.latest.version}:${ctx.changed.sectionId}`,
  });
  await refreshSetSummary(admin, ctx.setId);
  log.info("documents.summary.confirmed", {
    accountId: ctx.accountId,
    documentTypeId: ctx.type.id,
    version: ctx.latest.version,
  });
  return {
    ok: true,
    version: ctx.latest.version,
    href: `/documents/${ctx.setId}/${ctx.type.id}`,
  };
}

/**
 * FR-C2, "Redraft the summary" (D-2978, D-2982): one model request with the
 * changed section's new text as the context, the reply through the redraft
 * checks and the Year 6 gate, version n+1 with the change-log row, unadopted,
 * the state cleared; the limiter and the quota spent only when the model is
 * called; a refusal changes nothing and says so (D-2957).
 */
export async function redraftSummaryAction(
  input: unknown,
): Promise<SummaryActionResult> {
  const context = await summaryContext(input);
  if (!context.ok) return context;
  const { ctx } = context;
  if (!(await checkRedraftAllowed(ctx.accountId)))
    return { ok: false, message: REDRAFT_LIMITED };
  const admin = createSupabaseAdminClient();
  const quota = await admin.rpc("generation_quota_hit", {
    p_account: ctx.accountId,
  });
  if (quota.error) throw new Error(`quota: ${quota.error.message}`);
  if (quota.data === false) {
    log.warn("documents.summary.quota-exhausted", { accountId: ctx.accountId });
    return { ok: false, message: QUOTA_MESSAGE };
  }
  const filled = filledForRead(
    ctx.latest,
    await readFillInputs(ctx.supabase, ctx.accountId),
  );
  const request = buildSummaryRedraftRequest({
    type: ctx.type,
    model: filled,
    changedSectionId: ctx.changed.sectionId,
    modelId: modelId(),
  });
  const current = filled.sections.find(
    (s) => s.id === SUMMARY_SECTION_ID,
  )!.blocks;
  const dataset = getStandardsDataset();
  let reading: ReturnType<typeof readRedraftReply>;
  let usage: { inputTokens: number; outputTokens: number } | null = null;
  try {
    const reply = await createModelClient().complete(request, {
      documentTypeId: ctx.type.id,
      sectionId: "redraft-plain-language-summary",
    });
    usage = reply.usage ?? null;
    reading = readRedraftReply({
      text: reply.text,
      sectionId: SUMMARY_SECTION_ID,
      current,
      finding: "",
      tradingName: filled.facts.tradingName,
      allowedPhrases: dataset.registrationGroups.map((g) => g.name),
      readabilityGate: readabilityGateFor(
        ctx.type,
        sectionsFor(ctx.type).find((s) => s.id === SUMMARY_SECTION_ID),
      ),
      anchors: false,
    });
  } catch (e) {
    log.warn("documents.summary.unavailable", {
      accountId: ctx.accountId,
      reason: e instanceof Error ? e.name : "unknown",
    });
    return { ok: false, message: REDRAFT_UNAVAILABLE };
  }
  const logged = await admin.from("generation_log").insert({
    account_id: ctx.accountId,
    version_set_id: ctx.setId,
    document_type_id: ctx.type.id,
    section_id: SUMMARY_SECTION_ID,
    prompt_version: request.promptVersion,
    model: request.model,
    request_hash: requestHash(request),
    status: reading.ok ? "generated" : "fallback",
    attempts: 1,
    input_tokens: usage?.inputTokens ?? null,
    output_tokens: usage?.outputTokens ?? null,
    failure_kind: reading.ok ? null : "gate",
    failure_detail: reading.ok
      ? null
      : `summary redraft checks: ${reading.problems.length}`,
    source: `summary:${ctx.changed.sectionId}`.slice(0, 40),
  });
  if (logged.error)
    log.warn("documents.summary.log-failed", {
      accountId: ctx.accountId,
      code: logged.error.code,
    });
  if (!reading.ok) return { ok: false, message: REDRAFT_REFUSED_MESSAGE };
  const version = ctx.latest.version + 1;
  const model = redraftModel(ctx.latest.model, {
    sectionId: SUMMARY_SECTION_ID,
    blocks: reading.blocks,
    version,
    today: sydneyDay(),
    reference: "",
    previous:
      ctx.latest.adopted_on && ctx.latest.approver_name
        ? {
            name: ctx.latest.approver_name,
            role: ctx.latest.approver_role ?? null,
          }
        : null,
    changeText: summaryRedraftChangeText(ctx.changed.number),
  });
  const store = new SupabaseGenerationStore(admin);
  const path = objectPath(
    ctx.accountId,
    ctx.setId,
    `${ctx.type.id}.v${version}.docx`,
  );
  await store.putObject(
    path,
    new Uint8Array(await renderDocx(model)),
    DOCX_TYPE,
  );
  await store.insertDocumentVersion({
    version_set_id: ctx.setId,
    account_id: ctx.accountId,
    document_type_id: ctx.type.id,
    version,
    status: documentStatus(model).status,
    storage_path: path,
    model,
    summary_check_section_id: null,
    summary_check_on: null,
  });
  await admin.from("audit_log").insert({
    account_id: ctx.accountId,
    actor_user_id: ctx.userId,
    action: SUMMARY_REDRAFT_AUDIT_ACTION,
    target: `${ctx.type.id}:${version}:${ctx.changed.sectionId}`,
  });
  await refreshSetSummary(admin, ctx.setId);
  log.info("documents.summary.redrafted", {
    accountId: ctx.accountId,
    documentTypeId: ctx.type.id,
    version,
  });
  return { ok: true, version, href: `/documents/${ctx.setId}/${ctx.type.id}` };
}
