/**
 * The account a user logs for as a worker (REQ-020 FR-4), read with their
 * session: `memberships_select_own` lets the worker see their own row, and
 * the account row is read by id (a worker has no `is_member` rights, so the
 * trading name comes through the membership's own read of accounts... which
 * RLS hides; the service key reads the one public field instead). No
 * `server-only` so the integration suite can call it.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "@/lib/logging/logger";

export type WorkerMembership = {
  /** The account the worker logs for. */
  id: string;
  trading_name: string;
  worker_ref: string | null;
  /** REQ-024 SR-1 (AC-11): null until the worker has seen the collection notice once. */
  notice_seen_at: string | null;
};

export async function getWorkerMembership(
  supabase: SupabaseClient,
  admin: SupabaseClient | null,
  userId: string,
): Promise<WorkerMembership | null> {
  const m = await supabase
    .from("memberships")
    .select("account_id, worker_ref, notice_seen_at")
    .eq("user_id", userId)
    .eq("role", "worker")
    .limit(1)
    .maybeSingle();
  if (m.error) {
    log.error("accounts.worker.membership-failed", {
      userId,
      code: m.error.code,
    });
    return null;
  }
  if (!m.data) return null;
  const accountId = m.data.account_id as string;
  const reader = admin ?? supabase;
  const a = await reader
    .from("accounts")
    .select("id, trading_name, deleted_at")
    .eq("id", accountId)
    .maybeSingle();
  const row = a.data as {
    id: string;
    trading_name: string;
    deleted_at: string | null;
  } | null;
  if (a.error || !row || row.deleted_at) return null;
  return {
    id: row.id,
    trading_name: row.trading_name,
    worker_ref: (m.data.worker_ref as string | null) ?? null,
    notice_seen_at: (m.data.notice_seen_at as string | null) ?? null,
  };
}
