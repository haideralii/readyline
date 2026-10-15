/**
 * The Start here sheet from a set's rows (REQ-026 FR-1, FR-4, FR-5): built
 * from the document models (the shipped version for the lines, the latest
 * for what is done), the adoption state and the subscription, then handed
 * to the page as data or rendered as the Word file. Nothing here calls the
 * model. No `server-only` guard, so the generation runner's unit test can
 * import it; the page and the route read their rows through
 * `start-here-set.ts`.
 */
import type { DocumentModel } from "@/lib/generator/document-model";
import { renderDocx } from "@/lib/generator/render-docx";
import {
  buildStartHere,
  startHereModel,
  type StartHereSheet,
} from "@/lib/generator/start-here";
import type { DocumentVersionRow, VersionSetRow } from "./store";

export type StartHereBuilt = { sheet: StartHereSheet; model: DocumentModel };

export function startHereFromRows(input: {
  set: Pick<VersionSetRow, "derived_result" | "created_at">;
  first: readonly DocumentVersionRow[];
  latest: readonly DocumentVersionRow[];
  adopted: ReadonlySet<string>;
  subscribed: boolean;
  summaryVersion: string;
}): StartHereBuilt | null {
  const firstById = new Map(input.first.map((d) => [d.document_type_id, d]));
  const documents = input.latest.map((d) => ({
    typeId: d.document_type_id,
    original: firstById.get(d.document_type_id)?.model ?? d.model,
    latest: d.model,
    adopted: input.adopted.has(d.document_type_id),
  }));
  const facts = input.latest[0]?.model.facts;
  if (!facts) return null;
  const sheet = buildStartHere({
    tradingName: facts.tradingName,
    pathway: facts.pathway,
    result: input.set.derived_result,
    documents,
    subscribed: input.subscribed,
    generatedAt: input.set.created_at.slice(0, 10),
    summaryVersion: input.summaryVersion,
  });
  return { sheet, model: startHereModel(sheet, facts) };
}

export async function renderStartHere(built: StartHereBuilt): Promise<Buffer> {
  return renderDocx(built.model);
}
