import "server-only";
/**
 * The account's place on the guided path (REQ-017 FR-1, FR-4, D-1701): one
 * read per concern, folded into the pure `PathState` the strip and every
 * path page decide from. Reads run with the owner's session (RLS). Each
 * concern is skipped once an earlier one decides the step, so a signed-in
 * page costs at most a few small queries.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { checklistPeriod, deriveChecklist } from "@/lib/checklist/derive";
import { mergeChecklist } from "@/lib/checklist/state";
import { collectBlanks } from "@/lib/generator/blanks";
import { formBlanks } from "@/lib/generator/facts-fill";
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
import { currentPeriod } from "@/server/registers/registration-queries";
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

/**
 * Document type ids adopted in the account's newest ready set (REQ-024 A0,
 * D-2448, which narrows D-2440 after #77's signed-in run): a type counts
 * when any version of it in that set carries `adopted_on`, the first
 * adoption, so the guided path's adopt step, the checklist tick and the
 * Start here sheet read one truth and a facts re-render of an adopted
 * document never re-opens its group. A newer unadopted version is the
 * register's `new-version` state and the document page's "Adopt this
 * version" box, a nudge, never the path's gate; the pack keeps D-2440's rule
 * and ships the newest adopted version per type (`newestAdoptedVersions`).
 * A regenerated set is a new set, so its groups are offered again. The
 * policy review row is the mirror for `next_review_on` only.
 */
export async function listAdoptedTypeIds(
  supabase: SupabaseClient,
  accountId: string,
): Promise<Set<string>> {
  return new Set((await listAdoptedDates(supabase, accountId)).keys());
}

/** The same read with the day: each type adopted in the newest ready set and its newest adopted version's `adopted_on` (D-2435: the register shows it read-only). */
export async function listAdoptedDates(
  supabase: SupabaseClient,
  accountId: string,
): Promise<Map<string, string>> {
  const newest = await supabase
    .from("version_sets")
    .select("id")
    .eq("account_id", accountId)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const setId = newest.data?.id as string | undefined;
  if (!setId) return new Map();
  const r = await supabase
    .from("document_versions")
    .select("document_type_id, version, adopted_on")
    .eq("version_set_id", setId)
    .not("adopted_on", "is", null)
    .order("version", { ascending: false })
    .limit(2000);
  // Newest version first, so the first row per type is the newest adopted one.
  const out = new Map<string, string>();
  for (const row of (r.data as
    | { document_type_id: string; version: number; adopted_on: string }[]
    | null) ?? [])
    if (!out.has(row.document_type_id))
      out.set(row.document_type_id, row.adopted_on);
  return out;
}

/**
 * Blanks still open in the set's latest documents that the Finish form can
 * ask for: fact blanks (not signatures or register rows) whose key the
 * account does not hold (D-1704: the owner's name and role come from the
 * account page, the approval date from adoption). The same rule as the
 * form and the set page, so the strip leaves "finish" when the form has
 * nothing left to ask.
 */
export function openBlanks(documents: readonly DocumentVersionRow[]): number {
  return formBlanks(documents.flatMap((d) => collectBlanks(d.model))).length;
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
  const [stored, drafted, period] = await Promise.all([
    listChecklistItems(supabase, accountId),
    listDraftedDocumentTypeIds(supabase, accountId),
    // REQ-023 FR-4: the dated audit items once a registration period exists.
    currentPeriod(supabase, accountId),
  ]);
  const shown = mergeChecklist({
    checklist: deriveChecklist(
      result,
      answers,
      dataset,
      checklistPeriod(period),
    ),
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
