import "server-only";
/**
 * Read helpers that run with the user's session (RLS applies).
 * Pages call these to decide whether to render, redirect or prefill.
 */
import type { User } from "@supabase/supabase-js";
import { cache } from "react";
import { SupabaseEnvError } from "@/server/supabase/env";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";

import { getOwnedAccount, type Account } from "./owned-account";

export { getOwnedAccount, type Account };

export type DeletedAccount = {
  id: string;
  trading_name: string;
  deleted_at: string;
};

/**
 * The signed-in user, or null (also null when Supabase is not configured, so
 * public pages keep working). Backlog 2 (D-1012): read once per request;
 * the header, the next-step strip and the page each ask, and each ask was
 * a round trip to the auth server.
 */
export const getSessionUser = cache(async (): Promise<User | null> => {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    return data.user ?? null;
  } catch (e) {
    if (e instanceof SupabaseEnvError) return null;
    throw e;
  }
});

/**
 * A soft-deleted account the user owns (FR-6: sign-in refused until purge).
 * RLS hides deleted rows from the user, so this read uses the service key and
 * exposes only the three fields the "account deleted" page shows.
 */
export async function getDeletedAccount(
  userId: string,
): Promise<DeletedAccount | null> {
  try {
    const admin = createSupabaseAdminClient();
    const row = await admin
      .from("memberships")
      .select("account_id, accounts!inner(id, trading_name, deleted_at)")
      .eq("user_id", userId)
      .eq("role", "owner")
      .not("accounts.deleted_at", "is", null)
      .limit(1)
      .maybeSingle();
    if (row.error || !row.data) return null;
    const a = (row.data as unknown as { accounts: DeletedAccount }).accounts;
    return a?.deleted_at
      ? { id: a.id, trading_name: a.trading_name, deleted_at: a.deleted_at }
      : null;
  } catch (e) {
    if (e instanceof SupabaseEnvError) return null;
    throw e;
  }
}

export type Viewer = {
  user: User;
  account: Account | null;
  deleted: DeletedAccount | null;
};

/** The signed-in user and their owned account, or null when signed out; once per request (D-1012). */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createSupabaseServerClient();
  const account = await getOwnedAccount(supabase, user.id);
  const deleted = account ? null : await getDeletedAccount(user.id);
  return { user, account, deleted };
});
