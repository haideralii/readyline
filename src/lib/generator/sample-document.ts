/**
 * The sample document shown and downloadable before buying (batch 24 item
 * 2): the complaints policy from the recorded sole-trader reference set,
 * replayed from fixtures (no model call), with the fictional trading name
 * swapped for an obviously made-up one. `buildSampleDocument` is what the
 * writer test runs; the committed JSON in data/samples is what the pages
 * import, so no fixture file is read at request time on the server.
 */
import { documentTypeById } from "./catalogue";
import {
  buildSkeleton,
  type DocumentModel,
  type ResolvedSection,
} from "./document-model";
import { buildProviderFacts } from "./facts";
import { ReplayClient } from "./model-client";
import { loadReferenceCases } from "./reference-cases";
import {
  generateTailoredSection,
  isTailoredSection,
} from "@/server/generation/run";
import { getStandardsDataset } from "@/lib/standards/dataset";

export const SAMPLE_DOCUMENT_TYPE_ID =
  "complaints-management-policy-and-register";
export const SAMPLE_CASE_ID = "verification-sole-trader";
export const SAMPLE_TRADING_NAME = "Example Supports";
/** The sample is frozen to the day it was recorded so the file is reproducible. */
export const SAMPLE_GENERATED_AT = "2026-10-13";

export async function buildSampleDocument(): Promise<DocumentModel> {
  const dataset = getStandardsDataset();
  const c = loadReferenceCases().find((x) => x.id === SAMPLE_CASE_ID);
  if (!c) throw new Error(`sample: reference case ${SAMPLE_CASE_ID} missing`);
  const type = documentTypeById(SAMPLE_DOCUMENT_TYPE_ID);
  if (!type) throw new Error(`sample: document type missing`);
  const facts = buildProviderFacts(c.answers, c.result);
  const skeleton = buildSkeleton({
    type,
    facts,
    dataset,
    result: c.result,
    version: "1",
    generatedAt: SAMPLE_GENERATED_AT,
  });
  const client = new ReplayClient();
  const allowed = dataset.registrationGroups.map((g) => g.name);
  const sections: ResolvedSection[] = [];
  for (const section of skeleton.sections) {
    if (!isTailoredSection(type, section)) {
      sections.push(section);
      continue;
    }
    const out = await generateTailoredSection({
      section,
      type,
      facts,
      result: c.result,
      dataset,
      client,
      modelId: "claude-sonnet-5-5",
      allowedPhrases: allowed,
    });
    // REQ-016 S-4: the plain-language summary is new and unrecorded; it ships
    // as the marked generic text until the next recording session (D-542).
    if (
      out.section.status !== "generated" &&
      section.id !== "plain-language-summary"
    )
      throw new Error(`sample: section ${section.id} has no recorded fixture`);
    sections.push(out.section);
  }
  const model: DocumentModel = { ...skeleton, sections };
  return renameProvider(model, facts.tradingName, SAMPLE_TRADING_NAME);
}

/** Swaps the reference case's trading name for the sample's, everywhere in the model. */
export function renameProvider(
  model: DocumentModel,
  from: string,
  to: string,
): DocumentModel {
  const json = JSON.stringify(model).split(from).join(to);
  return JSON.parse(json) as DocumentModel;
}
