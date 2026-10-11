/**
 * Full generation of a document set for one account (REQ-005 FR-2, FR-3,
 * FR-6, SR-5) and regeneration of a single section (FR-5, AC-6). Pure with
 * respect to persistence and the model: both come in through interfaces, so
 * the unit test drives the whole pipeline with a fake model and an in-memory
 * store and CI never calls the network.
 */
import { createHash } from "node:crypto";
import { strToU8, zipSync } from "fflate";
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
import { generateSection } from "@/lib/generator/generate-section";
import type { ModelClient } from "@/lib/generator/model-client";
import { PROMPT_VERSION } from "@/lib/generator/prompts";
import { renderSummaryPdf } from "@/lib/generator/pdf-summary";
import { renderDocx } from "@/lib/generator/render-docx";
import { canonicalJson } from "@/lib/generator/prompts";
import type { QuestionnaireAnswers } from "@/lib/questionnaire/schema";
import type { QuestionnaireResult } from "@/lib/questionnaire/result";
import type { StandardsDataset } from "@/lib/standards/schema";
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

export function documentStatus(model: DocumentModel): {
  status: "ready" | "review";
  fallbackSections: number;
} {
  const fallbackSections = model.sections.filter(
    (s) => s.status === "fallback" || s.status === "placeholder",
  ).length;
  return {
    status: fallbackSections === 0 ? "ready" : "review",
    fallbackSections,
  };
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
  logs: Omit<GenerationLogRow, "account_id" | "version_set_id">[];
  usage: { inputTokens: number; outputTokens: number };
}> {
  const logs: Omit<GenerationLogRow, "account_id" | "version_set_id">[] = [];
  const usage = { inputTokens: 0, outputTokens: 0 };
  const specs = sectionsFor(input.type);
  const sections: ResolvedSection[] = [];
  for (const section of input.model.sections) {
    const spec = specs.find((s) => s.id === section.id);
    const wanted =
      spec?.mode === "tailored" && (!input.only || input.only === section.id);
    if (!spec || !wanted) {
      sections.push(section);
      continue;
    }
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
    usage.inputTokens += out.usage?.inputTokens ?? 0;
    usage.outputTokens += out.usage?.outputTokens ?? 0;
    logs.push({
      document_type_id: input.type.id,
      section_id: section.id,
      prompt_version: PROMPT_VERSION,
      model: input.modelId,
      request_hash: out.hash,
      status: out.status,
      attempts: out.attempts,
      input_tokens: out.usage?.inputTokens ?? null,
      output_tokens: out.usage?.outputTokens ?? null,
    });
    sections.push({
      ...section,
      status: out.status,
      blocks: out.blocks,
      usedFacts: out.usedFacts,
    });
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
      await store.insertDocumentVersion({
        version_set_id: set.id,
        account_id: input.accountId,
        document_type_id: typeId,
        version: 1,
        status,
        storage_path: path,
        model: filled.model,
      });
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
      `Readyline document set for ${facts.tradingName}, generated ${generatedAt}.\nOpen the .docx files in Word or LibreOffice. Sections marked "Review and complete" need your attention before use.\n`,
    );
    await store.putObject(
      objectPath(input.accountId, set.id, "set.zip"),
      zipSync(zipEntries, { level: 6 }),
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
  const next = await input.store.insertDocumentVersion({
    version_set_id: input.current.version_set_id,
    account_id: input.current.account_id,
    document_type_id: type.id,
    version: nextVersion,
    status,
    storage_path: path,
    model,
  });
  const outcome =
    model.sections.find((s) => s.id === input.sectionId)?.status === "generated"
      ? "generated"
      : "fallback";
  return { next, outcome };
}
