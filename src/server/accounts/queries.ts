import "server-only";
/**
 * Read helpers that run with the user's session (RLS applies).
 * Pages call these to decide whether to render, redirect or prefill.
 */
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { SupabaseEnvError } from "@/server/supabase/env";
import { createSupabaseServerClient } from "@/server/supabase/server";

export type Account = {
  id: string;
  trading_name: string;
  business_structure: string;
  states: string[];
  abn: string | null;
};

/** The signed-in user, or null (also null when Supabase is not configured, so public pages keep working). */
export async function getSessionUser(): Promise<User | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    return data.user ?? null;
  } catch (e) {
    if (e instanceof SupabaseEnvError) return null;
    throw e;
  }
}

export async function getOwnedAccount(
  supabase: SupabaseClient,
  userId: string,
): Promise<Account | null> {
  const membership = await supabase
    .from("memberships")
    .select(
      "account_id, accounts!inner(id, trading_name, business_structure, states, abn, deleted_at)",
    )
    .eq("user_id", userId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  if (membership.error || !membership.data) return null;
  const raw = membership.data as unknown as {
    accounts: Account & { deleted_at: string | null };
  };
  const a = raw.accounts;
  if (!a || a.deleted_at) return null;
  return {
    id: a.id,
    trading_name: a.trading_name,
    business_structure: a.business_structure,
    states: a.states,
    abn: a.abn,
  };
}

export type Viewer = { user: User; account: Account | null };

/** The signed-in user and their owned account, or null when signed out. */
export async function getViewer(): Promise<Viewer | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createSupabaseServerClient();
  return { user, account: await getOwnedAccount(supabase, user.id) };
}
