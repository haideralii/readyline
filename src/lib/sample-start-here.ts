/**
 * The sample's Start here sheet (REQ-031 FR-3; D-2888, D-2896): the committed
 * sole-trader reference case built through the same builder as an owner's
 * sheet, once when the module loads, from the fixture and the content file
 * alone (no model call, nothing read at request time). The shipped version
 * is the latest, nothing is adopted and there is no subscription, so every
 * line is to do. The same inputs write
 * product/evidence/req-026/start-here-sole-trader.txt (start-here.test.ts
 * with EVIDENCE=1), and sample-start-here.test.ts holds the two equal.
 */
import { documentTypeById } from "@/lib/generator/catalogue";
import {
  buildSkeleton,
  type DocumentModel,
} from "@/lib/generator/document-model";
import { buildProviderFacts } from "@/lib/generator/facts";
import { loadReferenceCases } from "@/lib/generator/reference-cases";
import {
  buildStartHere,
  type StartHereSheet,
} from "@/lib/generator/start-here";
import { getStandardsDataset } from "@/lib/standards/dataset";

export const SAMPLE_START_HERE_CASE = "verification-sole-trader";
/** The date the reference case was recorded; the sample's sheet is not generated for the viewer. */
export const SAMPLE_START_HERE_GENERATED_AT = "2026-10-15";

function build(): StartHereSheet {
  const c = loadReferenceCases().find((x) => x.id === SAMPLE_START_HERE_CASE);
  if (!c) throw new Error(`reference case ${SAMPLE_START_HERE_CASE} missing`);
  const dataset = getStandardsDataset();
  const facts = buildProviderFacts(c.answers, c.result);
  const documents = c.result.documents.map((d) => {
    const type = documentTypeById(d.id);
    if (!type) throw new Error(`document type ${d.id} missing`);
    const model: DocumentModel = buildSkeleton({
      type,
      facts,
      dataset,
      result: c.result,
      version: "1",
      generatedAt: SAMPLE_START_HERE_GENERATED_AT,
    });
    return { typeId: d.id, original: model, latest: model, adopted: false };
  });
  return buildStartHere({
    tradingName: facts.tradingName,
    pathway: c.result.pathway,
    result: c.result,
    documents,
    subscribed: false,
    generatedAt: SAMPLE_START_HERE_GENERATED_AT,
    summaryVersion: "1",
  });
}

export const SAMPLE_START_HERE: StartHereSheet = build();
