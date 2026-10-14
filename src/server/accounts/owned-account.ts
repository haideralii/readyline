/**
 * The account a user owns, read with their session (REQ-004 FR-10). Two
 * plain queries instead of a PostgREST embed: the embed depends on the
 * relationship being in PostgREST's schema cache, which the hosted project
 * did not have right after a migration, and the error was swallowed. Every
 * database error is now logged with its code and message (no email) and the
 * caller still gets null. No `server-only` here so the integration suite can
 * call it with a real client; nothing in it is secret.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "@/lib/logging/logger";

export type Account = {
  id: string;
  trading_name: string;
  business_structure: string;
  states: string[];
  abn: string | null;
  /** The date the Commission registered the provider (REQ-009 FR-3; REQ-017 FR-1 reads it for the path). */
  registration_date: string | null;
};

export async function getOwnedAccount(
  supabase: SupabaseClient,
  userId: string,
): Promise<Account | null> {
  const membership = await supabase
    .from("memberships")
    .select("account_id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  if (membership.error) {
    log.error("accounts.owned.membership-failed", {
      userId,
      code: membership.error.code,
      message: membership.error.message,
    });
    return null;
  }
  if (!membership.data) return null;
  const account = await supabase
    .from("accounts")
    .select(
      "id, trading_name, business_structure, states, abn, registration_date, deleted_at",
    )
    .eq("id", membership.data.account_id as string)
    .maybeSingle();
  if (account.error) {
    log.error("accounts.owned.account-failed", {
      userId,
      accountId: membership.data.account_id,
      code: account.error.code,
      message: account.error.message,
    });
    return null;
  }
  const a = account.data as (Account & { deleted_at: string | null }) | null;
  if (!a || a.deleted_at) return null;
  return {
    id: a.id,
    trading_name: a.trading_name,
    business_structure: a.business_structure,
    states: a.states,
    abn: a.abn,
    registration_date: a.registration_date ?? null,
  };
}
