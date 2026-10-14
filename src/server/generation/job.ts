/**
 * The paid generation job (REQ-007 FR-5, D-706). A pack entitlement enqueues
 * one `generation_jobs` row; this runner claims it and generates the set a
 * section at a time, persisting each finished section, so a tick can stop
 * when its time budget is spent and the next tick (the webhook's after()
 * hook, the job route's self-kick, or the cron) carries on where it left
 * off. Persistence and the model come in through interfaces so the unit test
 * drives several ticks with a fake clock and an in-memory backend.
 */
import { strToU8, zipSync } from "fflate";
import { collectBlanks, type DocumentBlank } from "@/lib/generator/blanks";
import { documentTypeById } from "@/lib/generator/catalogue";
import {
  buildSkeleton,
  type DocumentModel,
  type ResolvedSection,
} from "@/lib/generator/document-model";
import { buildProviderFacts } from "@/lib/generator/facts";
import { applyFacts } from "@/lib/generator/facts-fill";
import type { SectionFailure } from "@/lib/generator/generate-section";
import type { ModelClient } from "@/lib/generator/model-client";
import { renderSummaryPdf } from "@/lib/generator/pdf-summary";
import { renderDocx } from "@/lib/generator/render-docx";
import { log } from "@/lib/logging/logger";
import type { QuestionnaireAnswers } from "@/lib/questionnaire/schema";
import { buildResult } from "@/lib/questionnaire/result";
import type { StandardsDataset } from "@/lib/standards/schema";
import { documentsReadyEmail } from "@/server/email/templates";
import type { EmailProvider } from "@/server/email/provider";
import {
  DOCX_TYPE,
  documentStatus,
  generateTailoredSection,
  isTailoredSection,
  MAX_GENERIC_SECTIONS,
  readmeText,
  SELF_ASSESSMENT_ID,
  type SectionLog,
} from "./run";
import { objectPath } from "./storage";
import type { DocumentVersionRow, GenerationStore } from "./store";

export type JobStatus = "queued" | "running" | "ready" | "failed";

export type GenerationJobRow = {
  id: string;
  account_id: string;
  purchase_id: string | null;
  entitlement_id: string | null;
  assessment_id: string | null;
  status: JobStatus;
  attempts: number;
  next_document_index: number;
  version_set_id: string | null;
  progress: unknown;
  last_error: string | null;
  next_run_at: string;
  created_at: string;
  updated_at: string;
};

/** The document in flight: finished tailored sections by id and their log rows. */
export type JobProgress = {
  typeId?: string;
  sections?: Record<string, ResolvedSection>;
  logs?: SectionLog[];
  /** How many times each document was redrafted from scratch for too many generic sections (REQ-016 FR-0b). */
  redrafts?: Record<string, number>;
};

export type JobPatch = Partial<
  Pick<
    GenerationJobRow,
    | "status"
    | "attempts"
    | "next_document_index"
    | "version_set_id"
    | "progress"
    | "last_error"
    | "next_run_at"
  >
>;

export type JobContext = {
  answers: QuestionnaireAnswers;
  tradingName: string;
  ownerUserId: string;
  ownerEmail: string | null;
  entitlementRevoked: boolean;
  /** False when the current draft no longer hashes to the entitlement's assessment id (logged, not fatal). */
  assessmentMatches: boolean;
  /** The account facts given on an earlier pack (REQ-017 FR-2, AC-2): every blank they answer is filled before rendering. */
  facts: Record<string, string>;
};

export interface JobBackend {
  claim(leaseSeconds: number): Promise<GenerationJobRow | null>;
  update(id: string, patch: JobPatch): Promise<void>;
  loadContext(job: GenerationJobRow): Promise<JobContext | { error: string }>;
  listDocuments(versionSetId: string): Promise<DocumentVersionRow[]>;
  setEntitlementVersionSet(
    entitlementId: string,
    versionSetId: string,
  ): Promise<void>;
  /** Counts the set against the daily quota; the paid job is never blocked by it (D-706). */
  quotaHit(accountId: string): Promise<boolean>;
  audit(accountId: string, versionSetId: string): Promise<void>;
}

export const MAX_ATTEMPTS = 3;
/** How long a tick may generate before it hands the job back (fits a 60-second function). */
export const DEFAULT_BUDGET_MS = 40_000;

/** One fallen-back section for the tick line (REQ-016 FR-0b): the kind and rule names, never content. */
export type SectionFailureReport = {
  typeId: string;
  sectionId: string;
  kind: SectionFailure["kind"];
  detail: string;
  refusal: boolean;
};

export type TickReport =
  | { claimed: false }
  | {
      claimed: true;
      jobId: string;
      outcome: "ready" | "more" | "retry" | "failed";
      documentsDone: number;
      documentsTotal: number;
      sectionsGenerated: number;
      /** Sections that fell back to generic text in this tick, and documents redrafted (FR-0b). */
      failures?: SectionFailureReport[];
      redrafted?: string[];
    };

/** A document whose generic sections exceed MAX_GENERIC_SECTIONS is redrafted from scratch this many times before it ships as it is. */
export const MAX_DOCUMENT_REDRAFTS = 1;

function parseProgress(value: unknown): Required<JobProgress> {
  const p = (value ?? {}) as JobProgress;
  return {
    typeId: typeof p.typeId === "string" ? p.typeId : "",
    sections: p.sections && typeof p.sections === "object" ? p.sections : {},
    logs: Array.isArray(p.logs) ? p.logs : [],
    redrafts: p.redrafts && typeof p.redrafts === "object" ? p.redrafts : {},
  };
}

function backoff(attempts: number, now: Date): string {
  return new Date(now.getTime() + 2 ** attempts * 60_000).toISOString();
}

export async function runGenerationTick(input: {
  backend: JobBackend;
  store: GenerationStore;
  client: ModelClient;
  modelId: string;
  dataset: StandardsDataset;
  email: EmailProvider;
  siteUrl: string;
  now?: () => Date;
  budgetMs?: number;
}): Promise<TickReport> {
  const now = input.now ?? (() => new Date());
  const budgetMs = input.budgetMs ?? DEFAULT_BUDGET_MS;
  const { backend, store, dataset } = input;
  const job = await backend.claim(Math.ceil(budgetMs / 1000) + 60);
  if (!job) return { claimed: false };
  const started = now().getTime();
  const elapsed = () => now().getTime() - started;
  const over = () => elapsed() >= budgetMs;
  // D-1006: a document or a section is started only when the last one's
  // duration, with half again, still fits the budget; the first of a tick
  // has nothing to measure against and starts while the budget is open.
  let lastDocumentMs: number | null = null;
  let lastSectionMs: number | null = null;
  let sectionsGenerated = 0;
  let documentsThisTick = 0;
  const failures: SectionFailureReport[] = [];
  const redrafted: string[] = [];
  // A tick always does at least one unit of work, so a chain of short ticks
  // cannot stall on a budget smaller than one section.
  const fits = (lastMs: number | null) =>
    (sectionsGenerated === 0 && documentsThisTick === 0) ||
    (lastMs === null ? !over() : elapsed() + lastMs * 1.5 <= budgetMs);
  let documentsTotal = 0;
  let index = job.next_document_index;

  const failPermanently = async (reason: string, alert: boolean) => {
    await backend.update(job.id, {
      status: "failed",
      last_error: reason.slice(0, 500),
      next_run_at: now().toISOString(),
    });
    if (job.version_set_id)
      await store
        .finishVersionSet(job.version_set_id, {
          documents: 0,
          fallbackSections: 0,
          generated: 0,
          status: "failed",
        })
        .catch(() => undefined);
    const fields = {
      jobId: job.id,
      purchaseId: job.purchase_id,
      accountId: job.account_id,
      reason,
    };
    if (alert) log.error("payments.generation.failed", fields);
    else log.info("payments.generation.cancelled", fields);
    return {
      claimed: true as const,
      jobId: job.id,
      outcome: "failed" as const,
      documentsDone: index,
      documentsTotal,
      sectionsGenerated,
    };
  };

  try {
    const ctx = await backend.loadContext(job);
    if ("error" in ctx) return await failPermanently(ctx.error, true);
    if (ctx.entitlementRevoked)
      return await failPermanently(
        "entitlement revoked before generation",
        false,
      );
    if (!ctx.assessmentMatches)
      log.warn("payments.generation.answers-changed", {
        jobId: job.id,
        accountId: job.account_id,
      });
    const built = buildResult(dataset, ctx.answers);
    if (!built.ok) return await failPermanently(built.message, true);
    const result = built.result;
    const facts = buildProviderFacts(ctx.answers, result);
    const generatedAt = job.created_at.slice(0, 10);
    const allowed = dataset.registrationGroups.map((g) => g.name);
    const typeIds = [...result.documents.map((d) => d.id), SELF_ASSESSMENT_ID];
    documentsTotal = typeIds.length;

    let versionSetId = job.version_set_id;
    if (!versionSetId) {
      const set = await store.createVersionSet({
        accountId: job.account_id,
        createdBy: ctx.ownerUserId,
        answersHash: job.assessment_id?.split(":")[1] ?? "",
        result,
      });
      versionSetId = set.id;
      await backend.quotaHit(job.account_id);
      await backend.update(job.id, { version_set_id: versionSetId });
    }
    const setId = versionSetId;

    let progress = parseProgress(job.progress);
    const handBack = async (): Promise<TickReport> => {
      await backend.update(job.id, {
        status: "queued",
        next_document_index: index,
        progress,
        next_run_at: now().toISOString(),
      });
      return {
        claimed: true,
        jobId: job.id,
        outcome: "more",
        documentsDone: index,
        documentsTotal,
        sectionsGenerated,
        failures,
        redrafted,
      };
    };

    while (index < typeIds.length) {
      const typeId = typeIds[index];
      const type = documentTypeById(typeId);
      if (!type) {
        index++;
        continue;
      }
      if (!fits(lastDocumentMs)) return await handBack();
      const documentStarted = now().getTime();
      if (progress.typeId !== typeId)
        progress = {
          typeId,
          sections: {},
          logs: [],
          redrafts: progress.redrafts,
        };
      const skeleton = buildSkeleton({
        type,
        facts,
        dataset,
        result,
        version: "1",
        generatedAt,
      });
      for (const section of skeleton.sections) {
        if (!isTailoredSection(type, section) || progress.sections[section.id])
          continue;
        if (!fits(lastSectionMs)) return await handBack();
        const sectionStarted = now().getTime();
        const out = await generateTailoredSection({
          section,
          type,
          facts,
          result,
          dataset,
          client: input.client,
          modelId: input.modelId,
          allowedPhrases: allowed,
        });
        progress.sections[section.id] = out.section;
        progress.logs.push(out.log);
        if (out.failure)
          failures.push({
            typeId,
            sectionId: section.id,
            kind: out.failure.kind,
            detail: out.failure.detail,
            refusal: out.failure.refusal,
          });
        sectionsGenerated++;
        await backend.update(job.id, { progress });
        lastSectionMs = now().getTime() - sectionStarted;
      }
      // REQ-017 AC-2: facts the provider gave on an earlier pack fill this one's blanks too.
      const model: DocumentModel = applyFacts(
        {
          ...skeleton,
          sections: skeleton.sections.map((s) => progress.sections[s.id] ?? s),
        },
        ctx.facts,
      );
      // REQ-016 FR-0b: a document with too many generic sections is redrafted
      // from scratch once (the next tick takes it again with a fresh set of
      // calls); after that it ships as it is, with the reason on the log.
      const generic = documentStatus(model).fallbackSections;
      const redrafts = progress.redrafts?.[typeId] ?? 0;
      if (generic > MAX_GENERIC_SECTIONS && redrafts < MAX_DOCUMENT_REDRAFTS) {
        progress = {
          typeId: "",
          sections: {},
          logs: [],
          redrafts: { ...progress.redrafts, [typeId]: redrafts + 1 },
        };
        redrafted.push(typeId);
        log.warn("payments.generation.document-redraft", {
          jobId: job.id,
          accountId: job.account_id,
          documentTypeId: typeId,
          genericSections: generic,
          failures: failures.filter((f) => f.typeId === typeId),
        });
        return await handBack();
      }
      if (generic > MAX_GENERIC_SECTIONS)
        log.error("payments.generation.document-degraded", {
          jobId: job.id,
          accountId: job.account_id,
          documentTypeId: typeId,
          genericSections: generic,
          failures: failures.filter((f) => f.typeId === typeId),
        });
      const docx = await renderDocx(model);
      const path = objectPath(job.account_id, setId, `${typeId}.docx`);
      await store.putObject(path, new Uint8Array(docx), DOCX_TYPE);
      const { status } = documentStatus(model);
      await store.insertDocumentVersion({
        version_set_id: setId,
        account_id: job.account_id,
        document_type_id: typeId,
        version: 1,
        status,
        storage_path: path,
        model,
      });
      await store.insertLog(
        progress.logs.map((l) => ({
          ...l,
          account_id: job.account_id,
          version_set_id: setId,
        })),
      );
      index++;
      progress = {
        typeId: "",
        sections: {},
        logs: [],
        redrafts: progress.redrafts,
      };
      await backend.update(job.id, {
        next_document_index: index,
        progress: { redrafts: progress.redrafts },
      });
      // A resumed document measures only its remainder; the section rule still guards each call.
      lastDocumentMs = now().getTime() - documentStarted;
      documentsThisTick++;
      if (index < typeIds.length && over()) return await handBack();
    }

    // Every document exists: the summary, the zip and the hand-over.
    const rows = await backend.listDocuments(setId);
    const docs = typeIds
      .map((id) => rows.find((r) => r.document_type_id === id))
      .filter((r): r is DocumentVersionRow => Boolean(r));
    const summaries = docs.map((d) => {
      const { status, fallbackSections } = documentStatus(d.model);
      return { title: d.model.title, status, fallbackSections };
    });
    // REQ-016 S-8, FR-0c: the blanks by document and section, and the sections that carry one.
    const blanks: DocumentBlank[] = docs.flatMap((d) => collectBlanks(d.model));
    const providerInputSections = docs.reduce(
      (n, d) => n + documentStatus(d.model).providerInputSections,
      0,
    );
    const pdf = await renderSummaryPdf({
      facts,
      result,
      documents: summaries,
      blanks,
      generatedAt,
      version: "1",
    });
    await store.putObject(
      objectPath(job.account_id, setId, "readiness-summary.pdf"),
      pdf,
      "application/pdf",
    );
    const entries: Record<string, Uint8Array> = {};
    for (const d of docs)
      entries[`${d.document_type_id}.docx`] = await store.getObject(
        d.storage_path,
      );
    entries["readiness-summary.pdf"] = pdf;
    entries["README.txt"] = strToU8(readmeText(facts.tradingName, generatedAt));
    await store.putObject(
      objectPath(job.account_id, setId, "set.zip"),
      zipSync(entries, { level: 6 }),
      "application/zip",
    );
    const fallbackSections = summaries.reduce(
      (n, s) => n + s.fallbackSections,
      0,
    );
    await store.finishVersionSet(setId, {
      documents: docs.length,
      fallbackSections,
      generated: docs.reduce(
        (n, d) =>
          n + d.model.sections.filter((s) => s.status === "generated").length,
        0,
      ),
      providerInputSections,
      status: "ready",
    });
    if (job.entitlement_id)
      await backend.setEntitlementVersionSet(job.entitlement_id, setId);
    await backend.audit(job.account_id, setId);
    await backend.update(job.id, {
      status: "ready",
      progress: {},
      next_run_at: now().toISOString(),
    });
    if (ctx.ownerEmail)
      await input.email.send(
        documentsReadyEmail({
          to: ctx.ownerEmail,
          tradingName: ctx.tradingName,
          documentsUrl: `${input.siteUrl.replace(/\/$/, "")}/documents`,
        }),
      );
    log.info("payments.generation.ready", {
      jobId: job.id,
      purchaseId: job.purchase_id,
      accountId: job.account_id,
      versionSetId: setId,
      documents: docs.length,
      fallbackSections,
    });
    return {
      claimed: true,
      jobId: job.id,
      outcome: "ready",
      documentsDone: docs.length,
      documentsTotal,
      sectionsGenerated,
      failures,
      redrafted,
    };
  } catch (e) {
    const attempts = job.attempts + 1;
    const message = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    if (attempts >= MAX_ATTEMPTS) {
      await backend.update(job.id, { attempts });
      return await failPermanently(message, true);
    }
    await backend.update(job.id, {
      status: "queued",
      attempts,
      last_error: message,
      next_run_at: backoff(attempts, now()),
    });
    log.warn("payments.generation.retry", {
      jobId: job.id,
      accountId: job.account_id,
      attempts,
      error: message,
    });
    return {
      claimed: true,
      jobId: job.id,
      outcome: "retry",
      documentsDone: index,
      documentsTotal,
      sectionsGenerated,
    };
  }
}

/** Runs ticks until the budget is spent or no job is runnable; the route and the webhook hook use it. */
export async function runGenerationTicks(
  input: Parameters<typeof runGenerationTick>[0],
): Promise<{ reports: TickReport[]; more: boolean }> {
  const now = input.now ?? (() => new Date());
  const budgetMs = input.budgetMs ?? DEFAULT_BUDGET_MS;
  const started = now().getTime();
  const reports: TickReport[] = [];
  for (;;) {
    const remaining = budgetMs - (now().getTime() - started);
    if (remaining <= 0) return { reports, more: true };
    const report = await runGenerationTick({ ...input, budgetMs: remaining });
    reports.push(report);
    if (!report.claimed) return { reports, more: false };
    if (report.outcome === "more") return { reports, more: true };
    // ready, failed or retry: look for the next runnable job within the budget.
  }
}
