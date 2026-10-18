"use server";
/**
 * The redraft of one mapped section after an audit finding (REQ-033 Session
 * B FR-B1 to FR-B6, SR-B1 to SR-B5; D-2955 to D-2960). Two actions: the draft
 * (the gate again, the limiter and the quota, one model call, the reply
 * through the redraft checks, a log row with the finding's reference and no
 * words; nothing stored) and the accept (the blocks checked again against the
 * newest version, then version n+1 inserted by the service role with its
 * change-log row, unadopted; the finding and improvement rows carry the link;
 * one audit line). The provider's adoption through the existing flow is the
 * only approval (D-2955).
 */
import { z } from "zod";
import {
  documentTypeById,
  readabilityGateFor,
  sectionsFor,
  type DocumentTypeSpec,
} from "@/lib/generator/catalogue";
import type { DocumentModel } from "@/lib/generator/document-model";
import { createModelClient } from "@/lib/generator/model-client";
import { requestHash } from "@/lib/generator/prompts";
import { DEFAULT_MODEL } from "@/lib/generator/recording-plan";
import {
  REDRAFT_REFUSED_MESSAGE,
  buildRedraftRequest,
  readRedraftReply,
  redraftModel,
  redraftTarget,
  type RedraftStandard,
} from "@/lib/generator/redraft";
import { renderDocx } from "@/lib/generator/render-docx";
import { Block, type Block as BlockType } from "@/lib/generator/section-schema";
import { log } from "@/lib/logging/logger";
import { sydneyDay } from "@/lib/metrics/counters";
import { detectParticipantData } from "@/lib/privacy/participant-data";
import type { FindingRow } from "@/lib/registers/audit-day-types";
import { mapFinding } from "@/lib/registers/findings-map";
import {
  REDRAFT_LIMITED,
  REDRAFT_NEEDS_SUBSCRIPTION,
  REDRAFT_AUDIT_ACTION,
  REDRAFT_NOT_FOUND,
  REDRAFT_NO_PACK,
  REDRAFT_NO_SECTION,
  REDRAFT_NO_VERSION,
  REDRAFT_UNAVAILABLE,
  redraftTrailLine,
} from "@/lib/registers/findings-redraft";
import { summaryCheckFor } from "@/lib/registers/summary-check";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { parseInput, strictObject } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import {
  checkRedraftAllowed,
  checkRegisterWriteAllowed,
} from "@/server/auth/rate-limit";
import { latestReadySet } from "@/server/checklist/queries";
import { QUOTA_MESSAGE } from "@/server/generation/policy";
import { listDocumentVersions } from "@/server/generation/queries";
import { filledForRead, readFillInputs } from "@/server/generation/read-fill";
import { refreshSetSummary } from "@/server/generation/rerender";
import { DOCX_TYPE, documentStatus } from "@/server/generation/run";
import { objectPath } from "@/server/generation/storage";
import {
  SupabaseGenerationStore,
  type DocumentVersionRow,
} from "@/server/generation/store";
import { hasActiveSubscription } from "@/server/registers/queries";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";

const SIGN_IN = "Sign in to use the registers.";
const WRITE_LIMITED =
  "Too many changes in a minute. Wait a moment and try again.";

const TypeId = z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/);
const TargetInput = strictObject({
  findingId: z.string().uuid(),
  typeId: TypeId,
});
const AcceptInput = strictObject({
  findingId: z.string().uuid(),
  typeId: TypeId,
  blocks: z.array(Block).min(1).max(12),
});

export type DraftRedraftResult =
  | {
      ok: true;
      title: string;
      sectionNumber: string;
      heading: string;
      current: BlockType[];
      proposed: BlockType[];
      /** The version the redraft would follow. */
      version: number;
    }
  | { ok: false; message: string };

export type AcceptRedraftResult =
  { ok: true; version: number; href: string } | { ok: false; message: string };

function modelId(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

type Context = {
  type: DocumentTypeSpec;
  setId: string;
  latest: DocumentVersionRow;
  /** The newest version through the read-time fill: what the model and the page see. */
  filled: DocumentModel;
  sectionId: string;
  sectionNumber: string;
  heading: string;
  standard: RedraftStandard;
  allowed: string[];
  gate: { failAbove: number; shortSectionWords: number };
};

/** FR-B1, FR-B2: the finding, the document, its newest version and the one section, or the sentence that says why not. */
async function redraftContext(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  accountId: string,
  row: FindingRow,
  typeId: string,
): Promise<{ ok: true; ctx: Context } | { ok: false; message: string }> {
  const type = documentTypeById(typeId);
  if (!type) return { ok: false, message: REDRAFT_NO_VERSION };
  const doc = mapFinding(row.standard_id, row.indicator).documents.find(
    (d) => d.typeId === typeId,
  );
  if (!doc?.section || doc.section.mode !== "tailored")
    return { ok: false, message: REDRAFT_NO_SECTION };
  const { setId } = await latestReadySet(supabase, accountId);
  if (!setId) return { ok: false, message: REDRAFT_NO_PACK };
  const latest = (await listDocumentVersions(supabase, setId, typeId))[0];
  if (!latest) return { ok: false, message: REDRAFT_NO_VERSION };
  const filled = filledForRead(
    latest,
    await readFillInputs(supabase, accountId),
  );
  const target = redraftTarget(type, filled, doc.section.id);
  if (!target) return { ok: false, message: REDRAFT_NO_SECTION };
  const dataset = getStandardsDataset();
  const s = dataset.standards.find((x) => x.id === row.standard_id);
  if (!s) return { ok: false, message: REDRAFT_NO_SECTION };
  return {
    ok: true,
    ctx: {
      type,
      setId,
      latest,
      filled,
      sectionId: doc.section.id,
      sectionNumber: target.entry.number,
      heading: target.entry.heading,
      standard: {
        name: s.name,
        outcome: s.outcome,
        indicators: row.indicator.trim() ? [row.indicator] : s.indicators,
      },
      allowed: dataset.registrationGroups.map((g) => g.name),
      gate: readabilityGateFor(
        type,
        sectionsFor(type).find((x) => x.id === doc.section!.id),
      ),
    },
  };
}

async function loadFinding(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  accountId: string,
  id: string,
): Promise<FindingRow | null> {
  const r = await supabase
    .from("findings")
    .select("*")
    .eq("id", id)
    .eq("account_id", accountId)
    .maybeSingle();
  return (r.data as FindingRow | null) ?? null;
}

async function quotaAllows(accountId: string): Promise<boolean> {
  const r = await createSupabaseAdminClient().rpc("generation_quota_hit", {
    p_account: accountId,
  });
  if (r.error) throw new Error(`quota: ${r.error.message}`);
  return r.data !== false;
}

/**
 * FR-B2, FR-B3, SR-B1, SR-B3, SR-B5: one redraft, shown, not stored. The
 * gate runs on the finding's words again before anything reaches the model;
 * the limiter and the quota are spent only when the call is made; the log row
 * carries the finding's reference and the outcome, never the words.
 */
export async function draftRedraftAction(
  input: unknown,
): Promise<DraftRedraftResult> {
  const parsed = parseInput(TargetInput, input);
  if (!parsed.ok) return { ok: false, message: REDRAFT_NOT_FOUND };
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted)
    return { ok: false, message: SIGN_IN };
  const accountId = viewer.account.id;
  const supabase = await createSupabaseServerClient();
  if (!(await hasActiveSubscription(supabase, accountId)))
    return { ok: false, message: REDRAFT_NEEDS_SUBSCRIPTION };
  const row = await loadFinding(supabase, accountId, parsed.data.findingId);
  if (!row) return { ok: false, message: REDRAFT_NOT_FOUND };
  // SR-B1: the gate again (the detector may have gained a rule since the row was saved).
  const found = detectParticipantData(row.finding);
  if (found.length > 0) return { ok: false, message: found[0].message };
  const context = await redraftContext(
    supabase,
    accountId,
    row,
    parsed.data.typeId,
  );
  if (!context.ok) return context;
  const ctx = context.ctx;
  if (!(await checkRedraftAllowed(accountId)))
    return { ok: false, message: REDRAFT_LIMITED };
  if (!(await quotaAllows(accountId))) {
    log.warn("findings.redraft.quota-exhausted", { accountId });
    return { ok: false, message: QUOTA_MESSAGE };
  }
  const request = buildRedraftRequest({
    type: ctx.type,
    model: ctx.filled,
    sectionId: ctx.sectionId,
    standard: ctx.standard,
    finding: row.finding,
    modelId: modelId(),
  });
  const current = ctx.filled.sections.find(
    (s) => s.id === ctx.sectionId,
  )!.blocks;
  let reading: ReturnType<typeof readRedraftReply>;
  let usage: { inputTokens: number; outputTokens: number } | null = null;
  try {
    const reply = await createModelClient().complete(request, {
      documentTypeId: ctx.type.id,
      sectionId: `redraft-${ctx.sectionId}`,
    });
    usage = reply.usage ?? null;
    reading = readRedraftReply({
      text: reply.text,
      sectionId: ctx.sectionId,
      current,
      finding: row.finding,
      tradingName: ctx.filled.facts.tradingName,
      allowedPhrases: ctx.allowed,
      readabilityGate: ctx.gate,
    });
  } catch (e) {
    log.warn("findings.redraft.unavailable", {
      accountId,
      reason: e instanceof Error ? e.name : "unknown",
    });
    return { ok: false, message: REDRAFT_UNAVAILABLE };
  }
  const admin = createSupabaseAdminClient();
  const logged = await admin.from("generation_log").insert({
    account_id: accountId,
    version_set_id: ctx.setId,
    document_type_id: ctx.type.id,
    section_id: ctx.sectionId,
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
      : `redraft checks: ${reading.problems.length}`,
    source: `redraft:${row.reference}`,
  });
  if (logged.error)
    log.warn("findings.redraft.log-failed", {
      accountId,
      code: logged.error.code,
    });
  log.info("findings.redraft.drafted", {
    accountId,
    documentTypeId: ctx.type.id,
    sectionId: ctx.sectionId,
    accepted: reading.ok,
    problems: reading.ok ? 0 : reading.problems.length,
  });
  if (!reading.ok) return { ok: false, message: REDRAFT_REFUSED_MESSAGE };
  return {
    ok: true,
    title: ctx.type.title,
    sectionNumber: ctx.sectionNumber,
    heading: ctx.heading,
    current,
    proposed: reading.blocks,
    version: ctx.latest.version + 1,
  };
}

/**
 * FR-B5, FR-B6, SR-B4: "Use this redraft". The blocks go through the redraft
 * checks again against the newest version (nothing the browser sends is
 * trusted), then version n+1 is inserted by the service role with the
 * change-log row, unadopted; the finding row and the improvement row carry
 * the link; one audit line with the type, the version and the reference.
 */
export async function acceptRedraftAction(
  input: unknown,
): Promise<AcceptRedraftResult> {
  const parsed = parseInput(AcceptInput, input);
  if (!parsed.ok) return { ok: false, message: REDRAFT_REFUSED_MESSAGE };
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted)
    return { ok: false, message: SIGN_IN };
  const accountId = viewer.account.id;
  if (!(await checkRegisterWriteAllowed(viewer.user.id)))
    return { ok: false, message: WRITE_LIMITED };
  const supabase = await createSupabaseServerClient();
  if (!(await hasActiveSubscription(supabase, accountId)))
    return { ok: false, message: REDRAFT_NEEDS_SUBSCRIPTION };
  const row = await loadFinding(supabase, accountId, parsed.data.findingId);
  if (!row) return { ok: false, message: REDRAFT_NOT_FOUND };
  const found = detectParticipantData(row.finding);
  if (found.length > 0) return { ok: false, message: found[0].message };
  const context = await redraftContext(
    supabase,
    accountId,
    row,
    parsed.data.typeId,
  );
  if (!context.ok) return context;
  const ctx = context.ctx;
  const current = ctx.filled.sections.find(
    (s) => s.id === ctx.sectionId,
  )!.blocks;
  const reading = readRedraftReply({
    text: JSON.stringify({
      sectionId: ctx.sectionId,
      blocks: parsed.data.blocks,
    }),
    sectionId: ctx.sectionId,
    current,
    finding: row.finding,
    tradingName: ctx.filled.facts.tradingName,
    allowedPhrases: ctx.allowed,
    readabilityGate: ctx.gate,
  });
  if (!reading.ok) {
    log.info("findings.redraft.refused-on-accept", {
      accountId,
      problems: reading.problems.length,
    });
    return { ok: false, message: REDRAFT_REFUSED_MESSAGE };
  }
  const version = ctx.latest.version + 1;
  const today = sydneyDay();
  const model = redraftModel(ctx.latest.model, {
    sectionId: ctx.sectionId,
    blocks: reading.blocks,
    version,
    today,
    reference: row.reference,
    previous:
      ctx.latest.adopted_on && ctx.latest.approver_name
        ? {
            name: ctx.latest.approver_name,
            role: ctx.latest.approver_role ?? null,
          }
        : null,
  });
  const admin = createSupabaseAdminClient();
  const store = new SupabaseGenerationStore(admin);
  const path = objectPath(
    accountId,
    ctx.setId,
    `${ctx.type.id}.v${version}.docx`,
  );
  await store.putObject(
    path,
    new Uint8Array(await renderDocx(model)),
    DOCX_TYPE,
  );
  // REQ-033 Session C FR-C1 (D-2977): a redrafted section leaves the plain-words summary to check.
  const summary = summaryCheckFor(ctx.type, ctx.sectionId, today);
  const inserted = await store.insertDocumentVersion({
    version_set_id: ctx.setId,
    account_id: accountId,
    document_type_id: ctx.type.id,
    version,
    status: documentStatus(model).status,
    storage_path: path,
    model,
    summary_check_section_id: summary?.sectionId ?? null,
    summary_check_on: summary?.on ?? null,
  });
  const updated = await supabase
    .from("findings")
    .update({
      redraft_version_id: inserted.id,
      redraft_section_id: ctx.sectionId,
    })
    .eq("id", row.id)
    .eq("account_id", accountId);
  if (updated.error)
    log.warn("findings.redraft.row-update-failed", {
      accountId,
      code: updated.error.code,
    });
  if (row.improvement_id) {
    const imp = await supabase
      .from("improvements")
      .select("changed")
      .eq("id", row.improvement_id)
      .eq("account_id", accountId)
      .maybeSingle();
    const line = redraftTrailLine(ctx.type.title, ctx.sectionNumber, version);
    const changed = (imp.data?.changed as string | undefined) ?? "";
    await supabase
      .from("improvements")
      .update({ changed: changed ? `${changed}\n${line}` : line })
      .eq("id", row.improvement_id)
      .eq("account_id", accountId);
  }
  await supabase.from("register_events").insert({
    account_id: accountId,
    register: "findings",
    row_id: row.id,
    kind: "updated",
    note: `Section ${ctx.sectionNumber} of ${ctx.type.title} redrafted (version ${version})`,
  });
  const audit = await admin.from("audit_log").insert({
    account_id: accountId,
    actor_user_id: viewer.user.id,
    action: REDRAFT_AUDIT_ACTION,
    target: `${ctx.type.id}:${version}:${row.reference}`,
  });
  if (audit.error)
    log.warn("audit.write.failed", {
      action: REDRAFT_AUDIT_ACTION,
      code: audit.error.code,
    });
  await refreshSetSummary(admin, ctx.setId);
  log.info("findings.redraft.accepted", {
    accountId,
    documentTypeId: ctx.type.id,
    sectionId: ctx.sectionId,
    version,
  });
  return { ok: true, version, href: `/documents/${ctx.setId}/${ctx.type.id}` };
}
