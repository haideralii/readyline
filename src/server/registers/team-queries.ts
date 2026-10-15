import "server-only";
/**
 * The owner's view of the team and the links (REQ-020 FR-4, FR-5): pending
 * invitations (never the address, only the code and the dates), the
 * workers, the live report link, and the drafts waiting to be confirmed.
 * Reads run with the owner's session (RLS).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type InvitationRow = {
  id: string;
  worker_ref: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type WorkerRow = { user_id: string; worker_ref: string | null; created_at: string };

export type ReportLinkRow = { id: string; created_at: string; revoked_at: string | null };

export async function listInvitations(
  supabase: SupabaseClient,
  accountId: string,
): Promise<InvitationRow[]> {
  const r = await supabase
    .from("invitations")
    .select("id, worker_ref, expires_at, accepted_at, revoked_at, created_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (r.data as InvitationRow[] | null) ?? [];
}

export function pendingInvitations(rows: InvitationRow[], now = new Date()): InvitationRow[] {
  return rows.filter(
    (i) => !i.accepted_at && !i.revoked_at && Date.parse(i.expires_at) > now.getTime(),
  );
}

export async function listWorkers(
  supabase: SupabaseClient,
  accountId: string,
): Promise<WorkerRow[]> {
  const r = await supabase
    .from("memberships")
    .select("user_id, worker_ref, created_at")
    .eq("account_id", accountId)
    .eq("role", "worker")
    .order("created_at", { ascending: true })
    .limit(100);
  return (r.data as WorkerRow[] | null) ?? [];
}

export async function liveReportLink(
  supabase: SupabaseClient,
  accountId: string,
): Promise<ReportLinkRow | null> {
  const r = await supabase
    .from("report_links")
    .select("id, created_at, revoked_at")
    .eq("account_id", accountId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (r.data as ReportLinkRow | null) ?? null;
}

/** Drafts waiting for the owner (FR-5): counted here, never in the register's totals. */
export async function countReportsToConfirm(
  supabase: SupabaseClient,
  accountId: string,
): Promise<number> {
  const r = await supabase
    .from("incidents")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId)
    .eq("status", "draft");
  return r.count ?? 0;
}
