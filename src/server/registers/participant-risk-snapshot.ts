import "server-only";
/**
 * REQ-024 A2 (FR-4a; D-2421, D-2424 as amended, D-2428; findings 111, 154
 * and 158): the participant risk register as the Division 3 section carries
 * it. One named function, run under the admin client by the generation job
 * and by "Update the procedure", whose tenancy is its `accountId` argument
 * and nothing in the request; the snapshot goes into the fixed section's
 * blocks alone and never into a context pack or a prompt (CLAUDE.md 4.5).
 * Rows are codes and the risk text the owner typed, never a name. The
 * register's last-reviewed day is the latest `reviewed` or `created` event
 * under `participant_risks`, since the table holds `review_on` (the next
 * review) and no last-reviewed column.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParticipantRiskSnapshot } from "@/lib/generator/fixed-text";

export async function participantRiskSnapshot(
  admin: SupabaseClient,
  accountId: string,
  today: string,
): Promise<ParticipantRiskSnapshot> {
  const [rows, last] = await Promise.all([
    admin
      .from("participant_risks")
      .select("participant_ref, risk")
      .eq("account_id", accountId)
      .order("participant_ref", { ascending: true }),
    admin
      .from("register_events")
      .select("at")
      .eq("account_id", accountId)
      .eq("register", "participant_risks")
      .in("kind", ["reviewed", "created"])
      .order("at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (rows.error) throw rows.error;
  const at = (last.data as { at: string } | null)?.at ?? null;
  return {
    rows: (
      (rows.data as { participant_ref: string; risk: string }[] | null) ?? []
    ).map((r) => ({ code: r.participant_ref, risk: r.risk })),
    lastReviewedOn: at ? sydneyDay(at) : null,
    takenOn: today,
  };
}

/** The Sydney calendar day of an instant (D-2242). */
export function sydneyDay(instant: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instant));
}
