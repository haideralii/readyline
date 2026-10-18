import "server-only";
import { ANSWERS_VERSION, answersSchemaFor } from "@/lib/questionnaire/schema";
import { buildResult } from "@/lib/questionnaire/result";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { loadServerDraft } from "@/server/accounts/actions";

/**
 * REQ-035 FR-1, FR-4 (D-2966): the documents the account's own result calls
 * for, from the stored questionnaire draft; null while there is no result
 * to read. The gap check's type picker splits on it and the documents page
 * lists it as "What your pack holds" before a set exists.
 */
export async function resultDocuments(): Promise<
  { id: string; title: string }[] | null
> {
  const draft = await loadServerDraft();
  if (!draft) return null;
  const dataset = getStandardsDataset();
  const schema = answersSchemaFor(
    new Set(dataset.registrationGroups.map((g) => g.code)),
  );
  const parsed = schema.safeParse({
    ...(draft.answers as Record<string, unknown>),
    answersVersion: ANSWERS_VERSION,
  });
  if (!parsed.success) return null;
  const built = buildResult(dataset, parsed.data);
  if (!built.ok) return null;
  return built.result.documents.map((d) => ({ id: d.id, title: d.title }));
}
