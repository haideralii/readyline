import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GapState } from "@/lib/gap-check/words";

/**
 * REQ-035 FR-4, FR-5: the stored gap checks and their section lists, read
 * under the account's RLS; the newest check per document type for the
 * documents page, the checklist and the audit-day card.
 */
export type GapCheckRow = {
  id: string;
  account_id: string;
  document_type_id: string;
  title: string;
  covered: number;
  partly: number;
  missing: number;
  prompt_version: string;
  created_by: string | null;
  created_at: string;
};

export type GapCheckSectionRow = {
  id: string;
  gap_check_id: string;
  section_id: string;
  number: string;
  heading: string;
  position: number;
  state: GapState;
  reason: string;
  standard_ids: string[];
  indicator_labels: string[];
};

const CHECK_COLUMNS =
  "id, account_id, document_type_id, title, covered, partly, missing, prompt_version, created_by, created_at";

export async function listGapChecks(
  supabase: SupabaseClient,
  accountId: string,
): Promise<GapCheckRow[]> {
  const r = await supabase
    .from("gap_checks")
    .select(CHECK_COLUMNS)
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });
  return (r.data as GapCheckRow[] | null) ?? [];
}

export async function getGapCheck(
  supabase: SupabaseClient,
  id: string,
): Promise<GapCheckRow | null> {
  const r = await supabase
    .from("gap_checks")
    .select(CHECK_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  return (r.data as GapCheckRow | null) ?? null;
}

export async function listGapCheckSections(
  supabase: SupabaseClient,
  gapCheckId: string,
): Promise<GapCheckSectionRow[]> {
  const r = await supabase
    .from("gap_check_sections")
    .select(
      "id, gap_check_id, section_id, number, heading, position, state, reason, standard_ids, indicator_labels",
    )
    .eq("gap_check_id", gapCheckId)
    .order("position", { ascending: true });
  return (r.data as GapCheckSectionRow[] | null) ?? [];
}

/** The newest check per document type, in the order the rows came (newest first). */
export function latestPerType(rows: readonly GapCheckRow[]): GapCheckRow[] {
  const seen = new Set<string>();
  const out: GapCheckRow[] = [];
  for (const r of rows) {
    if (seen.has(r.document_type_id)) continue;
    seen.add(r.document_type_id);
    out.push(r);
  }
  return out;
}

/** FR-5: how many of the provider's own policies were checked and how many sections the newest checks leave to close. */
export function gapCheckSummary(rows: readonly GapCheckRow[]): {
  checked: number;
  toClose: number;
} {
  const latest = latestPerType(rows);
  return {
    checked: latest.length,
    toClose: latest.reduce((n, r) => n + r.partly + r.missing, 0),
  };
}

/** The run's day in Sydney, "19 October 2026". */
export function gapCheckDay(createdAt: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(createdAt));
}
