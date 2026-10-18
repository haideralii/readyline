"use server";
/**
 * REQ-031 FR-5 (D-2890; the Dev response's question 4 (a)): the owner's
 * reading of "What changed since the last audit", written once the page has
 * rendered (no write inside a GET render) on the current period row with the
 * owner's own session, so RLS keeps it to the owner: a member's call updates
 * no row and the column is unchanged (AC-10's third given). Nothing but the
 * time is written; no log line.
 */
import { revalidatePath } from "next/cache";
import { getViewer } from "@/server/accounts/queries";
import { currentPeriod } from "@/server/registers/registration-queries";
import { createSupabaseServerClient } from "@/server/supabase/server";

export type MarkWhatChangedReadResult =
  { ok: true; readAt: string } | { ok: false };

export async function markWhatChangedReadAction(): Promise<MarkWhatChangedReadResult> {
  const viewer = await getViewer();
  if (!viewer?.account) return { ok: false };
  const supabase = await createSupabaseServerClient();
  const period = await currentPeriod(supabase, viewer.account.id);
  if (!period) return { ok: false };
  const readAt = new Date().toISOString();
  const r = await supabase
    .from("registration_periods")
    .update({ what_changed_read_at: readAt })
    .eq("id", period.id)
    .eq("account_id", viewer.account.id)
    .select("id");
  if (r.error || !r.data?.length) return { ok: false };
  revalidatePath("/path/renewal");
  revalidatePath("/path/audit-day");
  return { ok: true, readAt };
}
