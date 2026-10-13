import "server-only";
/**
 * The account's place on the guided path (REQ-017 FR-1, FR-4, D-1701): one
 * read per concern, folded into the pure `PathState` the strip and every
 * path page decide from. Reads run with the owner's session (RLS). Each
 * concern is skipped once an earlier one decides the step, so a signed-in
 * page costs at most a few small queries.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { deriveChecklist } from "@/lib/checklist/derive";
import { mergeChecklist } from "@/lib/checklist/state";
import { collectBlanks } from "@/lib/generator/blanks";
import { factKeyFor } from "@/lib/generator/facts-fill";
import { orderDocuments } from "@/lib/generator/set-order";
import {
  EMPTY_PATH_STATE,
  nextStep,
  type PathState,
} from "@/lib/path/next-step";
import { deriveDocumentsState } from "@/lib/payments/documents-state";
import { ANSWERS_VERSION, answersSchemaFor } from "@/lib/questionnaire/schema";
import {
  buildResult,
  type QuestionnaireResult,
} from "@/lib/questionnaire/result";
import type { QuestionnaireAnswers } from "@/lib/questionnaire/schema";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { loadServerDraft } from "@/server/accounts/actions";
import type { Viewer } from "@/server/accounts/queries";
import {
  listChecklistItems,
  listDraftedDocumentTypeIds,
} from "@/server/checklist/queries";
import {
  getVersionSet,
  listLatestDocuments,
} from "@/server/generation/queries";
import {
  listEntitlements,
  listGenerationJobs,
  listPurchases,
} from "@/server/payments/queries";
import type { DocumentVersionRow } from "@/server/generation/store";

export type PathContext = {
  state: PathState;
  answers: QuestionnaireAnswers | null;
  result: QuestionnaireResult | null;
  /** The latest documents of the ready set, in audit order, when one exists. */
  documents: DocumentVersionRow[];
  /** Document type ids already adopted (policy review has an adopted date). */
  adopted: Set<string>;
};

/** The answers and result from the saved questionnaire, or nulls. */
export async function loadQuestionnaire(): Promise<{
  answers: QuestionnaireAnswers | null;
  result: QuestionnaireResult | null;
}> {
  const draft = await loadServerDraft();
  if (!draft) return { answers: null, result: null };
  const dataset = getStandardsDataset();
  const schema = answersSchemaFor(
    new Set(dataset.registrationGroups.map((g) => g.code)),
  );
  const parsed = schema.safeParse({
    answersVersion: ANSWERS_VERSION,
    ...draft.answers,
  });
  if (!parsed.success) return { answers: null, result: null };
  const built = buildResult(dataset, parsed.data);
  return built.ok
    ? { answers: parsed.data, result: built.result }
    : { answers: parsed.data, result: null };
}

/** Document type ids whose policy review carries an adopted date. */
export async function listAdoptedTypeIds(
  supabase: SupabaseClient,
  accountId: string,
): Promise<Set<string>> {
  const r = await supabase
    .from("policy_reviews")
    .select("document_type_id")
    .eq("account_id", accountId)
    .not("adopted_on", "is", null)
    .limit(500);
  return new Set(
    ((r.data as { document_type_id: string }[] | null) ?? []).map(
      (x) => x.document_type_id,
    ),
  );
}

/** Blanks still open in the set's latest documents, counting only fact blanks (not signatures or register rows). */
export function openBlanks(documents: readonly DocumentVersionRow[]): number {
  return documents
    .flatMap((d) => collectBlanks(d.model))
    .filter((b) => Boolean(factKeyFor(b.blank))).length;
}

/** Groups of the set (in audit order) with at least one document not yet adopted. */
export function groupsLeftToAdopt(
  documents: readonly DocumentVersionRow[],
  adopted: ReadonlySet<string>,
): number {
  return orderDocuments(documents).filter((g) =>
    g.documents.some((d) => !adopted.has(d.document_type_id)),
  ).length;
}

export async function loadPathContext(
  supabase: SupabaseClient,
  viewer: Viewer & { account: NonNullable<Viewer["account"]> },
): Promise<PathContext> {
  const accountId = viewer.account.id;
  const { answers, result } = await loadQuestionnaire();
  const state: PathState = {
    ...EMPTY_PATH_STATE,
    questionnaireDone: Boolean(result),
    registrationDateSet: Boolean(viewer.account.registration_date),
  };
  const empty = {
    state,
    answers,
    result,
    documents: [],
    adopted: new Set<string>(),
  };
  if (!result || !answers) return empty;

  const [purchases, entitlements, jobs] = await Promise.all([
    listPurchases(supabase, accountId),
    listEntitlements(supabase, accountId),
    listGenerationJobs(supabase, accountId),
  ]);
  const docsState = deriveDocumentsState({ purchases, entitlements, jobs });
  state.paid = docsState.kind !== "none" && docsState.kind !== "refunded";
  state.generating =
    docsState.kind === "preparing" || docsState.kind === "delayed";
  if (!state.paid || docsState.kind !== "ready") return { ...empty, state };

  const set = await getVersionSet(supabase, docsState.versionSetId);
  if (!set) return { ...empty, state };
  state.readySetId = set.id;
  const latest = await listLatestDocuments(supabase, set.id);
  const documents = orderDocuments(latest).flatMap((g) => g.documents);
  state.blanksLeft = openBlanks(documents);
  const adopted = await listAdoptedTypeIds(supabase, accountId);
  state.groupsToAdopt = groupsLeftToAdopt(documents, adopted);

  const dataset = getStandardsDataset();
  const [stored, drafted] = await Promise.all([
    listChecklistItems(supabase, accountId),
    listDraftedDocumentTypeIds(supabase, accountId),
  ]);
  const shown = mergeChecklist({
    checklist: deriveChecklist(result, answers, dataset),
    stored,
    draftedDocumentTypeIds: drafted,
  });
  const left = shown.items.filter((i) => i.status !== "have");
  state.checklistLeft = left.length;
  state.nextChecklistTitle = left[0]?.title ?? null;
  return { state, answers, result, documents, adopted };
}

/** The strip's content for a signed-in owner, or null when there is no account yet. */
export async function nextStepFor(
  supabase: SupabaseClient,
  viewer: Viewer | null,
) {
  if (!viewer?.account || viewer.deleted) return null;
  const ctx = await loadPathContext(
    supabase,
    viewer as Viewer & { account: NonNullable<Viewer["account"]> },
  );
  return nextStep(ctx.state);
}
