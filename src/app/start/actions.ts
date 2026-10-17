"use server";
/**
 * The one server action of the questionnaire (REQ-003 Q3, accepted): takes the
 * full answer set, re-validates it against the dataset's known classes and
 * returns the derived result. Nothing is stored (SR-3, SR-4) and the free-text
 * services note never reaches derivation (the adapter drops it).
 */
import { headers } from "next/headers";
import { deriveChecklist } from "@/lib/checklist/derive";
import { MemoryRateLimiter } from "@/lib/ops/health";
import { parseInput, type ParseFailed } from "@/lib/validation";
import { getStandardsDataset } from "@/lib/standards/dataset";
import {
  buildResult,
  type QuestionnaireResult,
} from "@/lib/questionnaire/result";
import { answersSchemaFor } from "@/lib/questionnaire/schema";
import { STATE_FILE } from "@/lib/registers/state-facts";
import { getViewer } from "@/server/accounts/queries";
import { clientIp } from "@/server/auth/paths";
import { createSupabaseServerClient } from "@/server/supabase/server";

/** The state's children's check and restrictive-practice lines from the state reference, where it has them (D-2310). */
function stateLines(state: string): StateAddedLines {
  const entry = (
    STATE_FILE.states as Record<
      string,
      | {
          name?: string;
          childrenCheck?: { text?: string };
          restrictivePractice?: { text?: string };
        }
      | undefined
    >
  )[state];
  return {
    state,
    name: entry?.name ?? state,
    childrenCheck: entry?.childrenCheck?.text ?? null,
    restrictivePractice: entry?.restrictivePractice?.text ?? null,
  };
}

/**
 * Backlog 5 (ASVS L1, REQ-004 SR-3): the one public action is pure compute
 * and stores nothing, so it needs no database limiter, but a loop could
 * still burn a function's time. 120 derivations per address per minute is
 * far above a person stepping back and forth, and above a whole Playwright
 * run from one address; the counter is per instance, like the health
 * route's (D-424).
 */
const DERIVE_LIMIT = { limit: 120, windowMs: 60_000 } as const;
const limiter = new MemoryRateLimiter(
  DERIVE_LIMIT.limit,
  DERIVE_LIMIT.windowMs,
);
const LIMITED_MESSAGE =
  "Too many requests from your connection just now. Wait a minute and try again.";

/** REQ-023 FR-11: the one state's own checks the conditional line carries (D-2310), from the state reference. */
export type StateAddedLines = {
  state: string;
  name: string;
  childrenCheck: string | null;
  restrictivePractice: string | null;
};

/** REQ-023 FR-11: how the new result differs from the latest completed assessment in the two answers that trigger a line. */
export type ResultChanges = {
  groupsChanged: boolean;
  statesAdded: StateAddedLines[];
};

export type DeriveResultResponse =
  | {
      ok: true;
      result: QuestionnaireResult;
      /** How many readiness checklist items the result yields (REQ-006 FR-5 teaser). */
      checklistTotal: number;
      /** REQ-023 FR-11: present for a signed-in owner with a ready set; absent otherwise. */
      changes?: ResultChanges;
    }
  | {
      ok: false;
      kind: "validation";
      fieldErrors: ParseFailed["fieldErrors"];
      formErrors: string[];
    }
  | { ok: false; kind: "derivation"; message: string };

export async function deriveResult(
  input: unknown,
): Promise<DeriveResultResponse> {
  const address = clientIp(await headers()) ?? "local";
  if (!limiter.allow(address))
    return { ok: false, kind: "derivation", message: LIMITED_MESSAGE };
  const dataset = getStandardsDataset();
  const schema = answersSchemaFor(
    new Set(dataset.registrationGroups.map((g) => g.code)),
  );
  const parsed = parseInput(schema, input);
  if (!parsed.ok) {
    return {
      ok: false,
      kind: "validation",
      fieldErrors: parsed.fieldErrors,
      formErrors: parsed.formErrors,
    };
  }
  const outcome = buildResult(dataset, parsed.data);
  if (!outcome.ok)
    return { ok: false, kind: "derivation", message: outcome.message };
  return {
    ok: true,
    result: outcome.result,
    checklistTotal: deriveChecklist(outcome.result, parsed.data, dataset).total,
    changes: await changesSince(
      outcome.result.groups.map((g) => g.code),
      parsed.data.business.states,
    ),
  };
}

/**
 * REQ-023 FR-11 (Session D; D-2310, D-2341): for a signed-in owner with a
 * ready set, how the new result differs from the account's latest completed
 * assessment in the two answers the Rules turn on: the registration groups
 * (a variation, NDIS Act s 73M) and the states (a change of area, Rules
 * s 13). The latest assessment is the newest ready version set's derived
 * result for the groups and the account's own states for the states, since
 * no other store holds the earlier answers (D-2341). Signed out, or with no
 * ready set, there is nothing to compare and the result says nothing. The
 * read is the viewer's own session; nothing is written (AC-6).
 */
async function changesSince(
  groups: readonly string[],
  states: readonly string[],
): Promise<ResultChanges | undefined> {
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted) return undefined;
  const supabase = await createSupabaseServerClient();
  const set = await supabase
    .from("version_sets")
    .select("derived_result")
    .eq("account_id", viewer.account.id)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const previous = (
    set.data as { derived_result?: { groups?: { code: string }[] } } | null
  )?.derived_result?.groups;
  if (!previous) return undefined;
  const before = new Set(previous.map((g) => g.code));
  const now = new Set(groups);
  const groupsChanged =
    before.size !== now.size || [...now].some((c) => !before.has(c));
  const known = new Set(viewer.account.states);
  const statesAdded = states.filter((s) => !known.has(s)).map(stateLines);
  return { groupsChanged, statesAdded };
}
