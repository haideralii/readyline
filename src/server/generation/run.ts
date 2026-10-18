/**
 * Full generation of a document set for one account (REQ-005 FR-2, FR-3,
 * FR-6, SR-5) and regeneration of a single section (FR-5, AC-6). Pure with
 * respect to persistence and the model: both come in through interfaces, so
 * the unit test drives the whole pipeline with a fake model and an in-memory
 * store and CI never calls the network.
 */
import { createHash } from "node:crypto";
import { strToU8, zipSync } from "fflate";
import { AI_DISCLOSURE, BRAND, GENERAL_INFORMATION_NOTICE } from "@/lib/brand";
import { sectionsWithBlanks } from "@/lib/generator/blanks";
import {
  documentTypeById,
  sectionsFor,
  type DocumentTypeSpec,
} from "@/lib/generator/catalogue";
import { buildContextPackFromFacts } from "@/lib/generator/context-pack";
import {
  buildSkeleton,
  type DocumentModel,
  type ResolvedSection,
} from "@/lib/generator/document-model";
import { buildProviderFacts, type ProviderFacts } from "@/lib/generator/facts";
import {
  generateSection,
  type SectionFailure,
} from "@/lib/generator/generate-section";
import type { ModelClient } from "@/lib/generator/model-client";
import { PROMPT_VERSION } from "@/lib/generator/prompts";
import { renderSummaryPdf } from "@/lib/generator/pdf-summary";
import { renderDocx } from "@/lib/generator/render-docx";
import { canonicalJson } from "@/lib/generator/prompts";
import type { QuestionnaireAnswers } from "@/lib/questionnaire/schema";
import type { QuestionnaireResult } from "@/lib/questionnaire/result";
import type { StandardsDataset } from "@/lib/standards/schema";
import { START_HERE_FILE } from "@/lib/generator/start-here";
import { sydneyDay } from "@/lib/metrics/counters";
import { summaryCheckFor } from "@/lib/registers/summary-check";
import { renderStartHere, startHereFromRows } from "./start-here";
import { objectPath } from "./storage";
import type {
  DocumentVersionRow,
  GenerationLogRow,
  GenerationStore,
} from "./store";

export const SELF_ASSESSMENT_ID = "practice-standards-self-assessment";
export const DOCX_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type GenerationSummary = {
  versionSetId: string;
  documents: {
    typeId: string;
    title: string;
    status: "ready" | "review";
    fallbackSections: number;
    path: string;
  }[];
  generatedSections: number;
  fallbackSections: number;
  usage: { inputTokens: number; outputTokens: number };
};

export function answersHash(answers: QuestionnaireAnswers): string {
  const { supports, ...rest } = answers;
  // The free-text note is not part of the generation inputs, so it is left out of the hash too.
  const { servicesNote: _note, ...supportsWithoutNote } = supports;
  void _note;
  return createHash("sha256")
    .update(canonicalJson({ ...rest, supports: supportsWithoutNote }), "utf8")
    .digest("hex");
}

/** A document ships with at most this many generic (fallback) sections; above it the job redrafts it once (REQ-016 FR-0b). */
export const MAX_GENERIC_SECTIONS = 2;

export function documentStatus(model: DocumentModel): {
  status: "ready" | "review";
  /** Sections the generator could not draft: generic text (fallback) or still a placeholder. */
  fallbackSections: number;
  /** Sections still undrafted: a placeholder with no text at all (FR-0c: never shipped). */
  undraftedSections: number;
  /** Sections carrying a blank for the provider (FR-0c: what the set page counts). */
  providerInputSections: number;
} {
  const fallbackSections = model.sections.filter(
    (s) => s.status === "fallback" || s.status === "placeholder",
  ).length;
  const undraftedSections = model.sections.filter(
    (s) => s.status === "placeholder",
  ).length;
  return {
    status: fallbackSections === 0 ? "ready" : "review",
    fallbackSections,
    undraftedSections,
    providerInputSections: sectionsWithBlanks(model),
  };
}

export type SectionLog = Omit<
  GenerationLogRow,
  "account_id" | "version_set_id"
>;

/**
 * One tailored section through the model and its gates. Shared by the
 * in-request runner below and the resumable paid job (REQ-007 FR-5), which
 * persists each finished section so a tick can stop between sections.
 */
export async function generateTailoredSection(input: {
  section: ResolvedSection;
  type: DocumentTypeSpec;
  facts: ProviderFacts;
  result: QuestionnaireResult;
  dataset: StandardsDataset;
  client: ModelClient;
  modelId: string;
  allowedPhrases: string[];
}): Promise<{
  section: ResolvedSection;
  log: SectionLog;
  usage: { inputTokens: number; outputTokens: number };
  /** Why the section fell back (REQ-016 FR-0b), for the tick line; null when generated. */
  failure: SectionFailure | null;
}> {
  const spec = sectionsFor(input.type).find((s) => s.id === input.section.id);
  if (!spec || spec.mode !== "tailored")
    throw new Error(`section ${input.section.id} is not tailored`);
  const pack = buildContextPackFromFacts({
    facts: input.facts,
    result: input.result,
    dataset: input.dataset,
    type: input.type,
    section: spec,
  });
  const out = await generateSection({
    pack,
    client: input.client,
    model: input.modelId,
    allowedPhrases: input.allowedPhrases,
  });
  return {
    section: {
      ...input.section,
      status: out.status,
      blocks: out.blocks,
      usedFacts: out.usedFacts,
    },
    log: {
      document_type_id: input.type.id,
      section_id: input.section.id,
      prompt_version: PROMPT_VERSION,
      model: input.modelId,
      request_hash: out.hash,
      status: out.status,
      attempts: out.attempts,
      input_tokens: out.usage?.inputTokens ?? null,
      output_tokens: out.usage?.outputTokens ?? null,
      cache_creation_input_tokens: out.usage?.cacheCreationInputTokens ?? null,
      cache_read_input_tokens: out.usage?.cacheReadInputTokens ?? null,
      failure_kind: out.failure?.kind ?? null,
      failure_detail: out.failure
        ? `${out.failure.detail}${out.failure.refusal ? " (refusal)" : ""}`.slice(
            0,
            300,
          )
        : null,
    },
    usage: {
      inputTokens: out.usage?.inputTokens ?? 0,
      outputTokens: out.usage?.outputTokens ?? 0,
    },
    failure: out.failure,
  };
}

/** True for the sections of a skeleton the model fills. */
export function isTailoredSection(
  type: DocumentTypeSpec,
  section: ResolvedSection,
): boolean {
  return (
    sectionsFor(type).find((s) => s.id === section.id)?.mode === "tailored"
  );
}

/**
 * The one-page cover note shipped inside every set.zip (REQ-016 D-058): the
 * general-information notice and the AI disclosure live here, on the
 * download page and on the readiness summary's first page, never inside the
 * provider's own policies.
 */
export function readmeText(tradingName: string, generatedAt: string): string {
  return [
    `${BRAND} document set for ${tradingName}, drafted ${generatedAt}.`,
    "",
    "What is in this zip: one Word document (.docx) for each policy, procedure, plan or template in your set, the readiness summary (PDF), and this note.",
    "",
    // REQ-026 FR-7: the sheet is the list of what to do; the summary keeps its blanks list.
    `How to use them: open ${START_HERE_FILE} first. It lists, document by document, what to fill in, what to review and what to read once, in the order to adopt them. Fill in every bracketed blank, such as [name] or [date]; the readiness summary lists them by document and section too. A section marked "Generic text: add your details" is complete but general; make it yours. When you have reviewed and adopted a document, mark it Done on your checklist.`,
    "",
    "About these documents:",
    GENERAL_INFORMATION_NOTICE,
    AI_DISCLOSURE,
    "",
  ].join("\n");
}

async function fillTailoredSections(input: {
  model: DocumentModel;
  type: DocumentTypeSpec;
  facts: ProviderFacts;
  result: QuestionnaireResult;
  dataset: StandardsDataset;
  client: ModelClient;
  modelId: string;
  allowedPhrases: string[];
  only?: string;
}): Promise<{
  model: DocumentModel;
  logs: SectionLog[];
  usage: { inputTokens: number; outputTokens: number };
}> {
  const logs: SectionLog[] = [];
  const usage = { inputTokens: 0, outputTokens: 0 };
  const sections: ResolvedSection[] = [];
  for (const section of input.model.sections) {
    const wanted =
      isTailoredSection(input.type, section) &&
      (!input.only || input.only === section.id);
    if (!wanted) {
      sections.push(section);
      continue;
    }
    const out = await generateTailoredSection({ ...input, section });
    usage.inputTokens += out.usage.inputTokens;
    usage.outputTokens += out.usage.outputTokens;
    logs.push(out.log);
    sections.push(out.section);
  }
  return { model: { ...input.model, sections }, logs, usage };
}

export async function generateDocumentSet(input: {
  store: GenerationStore;
  client: ModelClient;
  modelId: string;
  dataset: StandardsDataset;
  accountId: string;
  userId: string;
  answers: QuestionnaireAnswers;
  result: QuestionnaireResult;
  now: Date;
}): Promise<GenerationSummary> {
  const { store, dataset, result } = input;
  const facts = buildProviderFacts(input.answers, result);
  const generatedAt = input.now.toISOString().slice(0, 10);
  const allowed = dataset.registrationGroups.map((g) => g.name);
  const set = await store.createVersionSet({
    accountId: input.accountId,
    createdBy: input.userId,
    answersHash: answersHash(input.answers),
    result,
  });
  const version = "1";
  const typeIds = [...result.documents.map((d) => d.id), SELF_ASSESSMENT_ID];
  const summary: GenerationSummary = {
    versionSetId: set.id,
    documents: [],
    generatedSections: 0,
    fallbackSections: 0,
    usage: { inputTokens: 0, outputTokens: 0 },
  };
  const logRows: GenerationLogRow[] = [];
  const zipEntries: Record<string, Uint8Array> = {};
  const shipped: DocumentVersionRow[] = [];
  try {
    for (const typeId of typeIds) {
      const type = documentTypeById(typeId);
      if (!type) continue;
      const skeleton = buildSkeleton({
        type,
        facts,
        dataset,
        result,
        version,
        generatedAt,
      });
      const filled = await fillTailoredSections({
        model: skeleton,
        type,
        facts,
        result,
        dataset,
        client: input.client,
        modelId: input.modelId,
        allowedPhrases: allowed,
      });
      summary.usage.inputTokens += filled.usage.inputTokens;
      summary.usage.outputTokens += filled.usage.outputTokens;
      for (const l of filled.logs)
        logRows.push({
          ...l,
          account_id: input.accountId,
          version_set_id: set.id,
        });
      const docx = await renderDocx(filled.model);
      const path = objectPath(input.accountId, set.id, `${typeId}.docx`);
      await store.putObject(path, new Uint8Array(docx), DOCX_TYPE);
      zipEntries[`${typeId}.docx`] = new Uint8Array(docx);
      const { status, fallbackSections } = documentStatus(filled.model);
      summary.generatedSections += filled.model.sections.filter(
        (s) => s.status === "generated",
      ).length;
      summary.fallbackSections += fallbackSections;
      const row = await store.insertDocumentVersion({
        version_set_id: set.id,
        account_id: input.accountId,
        document_type_id: typeId,
        version: 1,
        status,
        storage_path: path,
        model: filled.model,
      });
      shipped.push(row);
      summary.documents.push({
        typeId,
        title: type.title,
        status,
        fallbackSections,
        path,
      });
    }
    const pdf = await renderSummaryPdf({
      facts,
      result,
      documents: summary.documents.map((d) => ({
        title: d.title,
        status: d.status,
        fallbackSections: d.fallbackSections,
      })),
      generatedAt,
      version,
    });
    await store.putObject(
      objectPath(input.accountId, set.id, "readiness-summary.pdf"),
      pdf,
      "application/pdf",
    );
    zipEntries["readiness-summary.pdf"] = pdf;
    zipEntries["README.txt"] = strToU8(
      readmeText(facts.tradingName, generatedAt),
    );
    // REQ-026 FR-1: the Start here sheet first in the zip.
    const startHere = startHereFromRows({
      set: { derived_result: result, created_at: generatedAt },
      first: shipped,
      latest: shipped,
      adopted: new Set(),
      subscribed: false,
      summaryVersion: version,
    });
    const ordered: Record<string, Uint8Array> = startHere
      ? {
          [START_HERE_FILE]: new Uint8Array(await renderStartHere(startHere)),
          ...zipEntries,
        }
      : zipEntries;
    await store.putObject(
      objectPath(input.accountId, set.id, "set.zip"),
      zipSync(ordered, { level: 6 }),
      "application/zip",
    );
    await store.insertLog(logRows);
    await store.finishVersionSet(set.id, {
      documents: summary.documents.length,
      fallbackSections: summary.fallbackSections,
      generated: summary.generatedSections,
      status: "ready",
    });
  } catch (e) {
    await store.insertLog(logRows).catch(() => undefined);
    await store.finishVersionSet(set.id, {
      documents: summary.documents.length,
      fallbackSections: summary.fallbackSections,
      generated: summary.generatedSections,
      status: "failed",
    });
    throw e;
  }
  return summary;
}

/** Regenerates one tailored section and records a new document version (FR-5, AC-6). */
export async function regenerateSection(input: {
  store: GenerationStore;
  client: ModelClient;
  modelId: string;
  dataset: StandardsDataset;
  current: DocumentVersionRow;
  result: QuestionnaireResult;
  sectionId: string;
  /** The Sydney day for the summary's state (REQ-033 Session C); today when absent. */
  today?: string;
}): Promise<{ next: DocumentVersionRow; outcome: "generated" | "fallback" }> {
  const type = documentTypeById(input.current.document_type_id);
  if (!type)
    throw new Error(`unknown document type ${input.current.document_type_id}`);
  const spec = sectionsFor(type).find((s) => s.id === input.sectionId);
  if (!spec || spec.mode !== "tailored")
    throw new Error("only tailored sections can be regenerated");
  const allowed = input.dataset.registrationGroups.map((g) => g.name);
  const filled = await fillTailoredSections({
    model: input.current.model,
    type,
    facts: input.current.model.facts,
    result: input.result,
    dataset: input.dataset,
    client: input.client,
    modelId: input.modelId,
    allowedPhrases: allowed,
    only: input.sectionId,
  });
  const nextVersion = input.current.version + 1;
  const model: DocumentModel = {
    ...filled.model,
    version: String(nextVersion),
  };
  const docx = await renderDocx(model);
  const path = objectPath(
    input.current.account_id,
    input.current.version_set_id,
    `${type.id}.v${nextVersion}.docx`,
  );
  await input.store.putObject(path, new Uint8Array(docx), DOCX_TYPE);
  await input.store.insertLog(
    filled.logs.map((l) => ({
      ...l,
      account_id: input.current.account_id,
      version_set_id: input.current.version_set_id,
    })),
  );
  const { status } = documentStatus(model);
  // REQ-033 Session C FR-C1 (D-2977): a re-generated section leaves the plain-words summary to check.
  const summary = summaryCheckFor(
    type,
    input.sectionId,
    input.today ?? sydneyDay(),
  );
  const next = await input.store.insertDocumentVersion({
    version_set_id: input.current.version_set_id,
    account_id: input.current.account_id,
    document_type_id: type.id,
    version: nextVersion,
    status,
    storage_path: path,
    model,
    summary_check_section_id: summary?.sectionId ?? null,
    summary_check_on: summary?.on ?? null,
  });
  const outcome =
    model.sections.find((s) => s.id === input.sectionId)?.status === "generated"
      ? "generated"
      : "fallback";
  return { next, outcome };
}
