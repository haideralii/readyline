import "server-only";
/**
 * Reads for the registers subscription (REQ-009 Session C), with the user's
 * session so RLS applies: the account's latest subscription row and the
 * reminders due soon for the account page's "Due soon" list.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReminderRow } from "@/lib/registers/types";

export type SubscriptionView = {
  id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string | null;
  status: string;
  current_period_end: string | null;
  entitlement_id: string | null;
  created_at: string;
  /** Fake mode only: the fake session id that stands in for the portal. */
  fake_session_id?: string | null;
};

export async function getSubscription(
  supabase: SupabaseClient,
  accountId: string,
): Promise<SubscriptionView | null> {
  const r = await supabase
    .from("subscriptions")
    .select(
      "id, stripe_subscription_id, stripe_customer_id, status, current_period_end, entitlement_id, created_at",
    )
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = (r.data as SubscriptionView | null) ?? null;
  if (!row) return null;
  // In fake mode the subscription id carries the session id's hash only; the
  // fake portal link is the fake checkout page keyed by the subscription id.
  return {
    ...row,
    fake_session_id: row.stripe_subscription_id.startsWith("sub_fake_")
      ? row.stripe_subscription_id
      : null,
  };
}

/** Reminders whose day has come or comes within `days`, newest due first (FR-3, "Due soon"). */
export async function listUpcomingReminders(
  supabase: SupabaseClient,
  accountId: string,
  today: string,
  days = 30,
): Promise<ReminderRow[]> {
  const until = new Date(`${today}T00:00:00Z`);
  until.setUTCDate(until.getUTCDate() + days);
  const r = await supabase
    .from("reminders")
    .select("*")
    .eq("account_id", accountId)
    .lte("send_on", until.toISOString().slice(0, 10))
    .order("due_on", { ascending: true })
    .limit(20);
  return (r.data as ReminderRow[] | null) ?? [];
}
