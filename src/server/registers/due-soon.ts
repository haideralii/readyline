import "server-only";
/**
 * "Due soon" for the account page (batch 45 item 5): the live incident,
 * worker check and policy review dates inside the window, with the stored
 * reminder rows for everything else, in the order `dueSoonLines` sets.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { dueSoonLines, type DueSoonLine } from "@/lib/registers/due-soon";
import { reminderLine } from "@/lib/registers/reminders";
import type {
  IncidentRow,
  PolicyReviewRow,
  ReminderRow,
  WorkerClearanceRow,
} from "@/lib/registers/types";
import { listUpcomingReminders } from "@/server/payments/subscription-queries";
import { reminderReference } from "@/server/registers/queries";

export async function dueSoonForAccount(
  supabase: SupabaseClient,
  account: { id: string; trading_name: string; states?: string[] | null },
  today: string,
  days = 30,
): Promise<DueSoonLine[]> {
  const [inc, checks, reviews, stored] = await Promise.all([
    supabase
      .from("incidents")
      .select(
        "id, reference, reportable, notify_by, reportable_notified_on, status, occurred_on, aware_on, category, severity",
      )
      .eq("account_id", account.id)
      .eq("reportable", true)
      .is("reportable_notified_on", null)
      .neq("status", "closed")
      .limit(200),
    supabase
      .from("worker_clearances")
      .select("id, worker_ref, role_label, expires_on")
      .eq("account_id", account.id)
      .not("expires_on", "is", null)
      .limit(500),
    supabase
      .from("policy_reviews")
      .select("id, title, next_review_on")
      .eq("account_id", account.id)
      .not("next_review_on", "is", null)
      .limit(500),
    listUpcomingReminders(supabase, account.id, today, days),
  ]);
  const rows = <T>(r: { data: unknown }) => (r.data as T[] | null) ?? [];
  const storedLines = await Promise.all(
    rows<ReminderRow>({ data: stored }).map(async (r) => ({
      id: r.id,
      kind: r.kind,
      line: reminderLine(
        r.kind,
        await reminderReference(supabase, r, account.trading_name),
        r.due_on,
      ),
      dueOn: r.due_on,
      sent: Boolean(r.sent_at),
    })),
  );
  return dueSoonLines({
    today,
    days,
    incidents:
      rows<
        Pick<
          IncidentRow,
          | "id"
          | "reference"
          | "reportable"
          | "notify_by"
          | "reportable_notified_on"
          | "status"
          | "occurred_on"
          | "aware_on"
          | "category"
          | "severity"
        >
      >(inc),
    states: account.states ?? [],
    clearances:
      rows<
        Pick<
          WorkerClearanceRow,
          "id" | "worker_ref" | "role_label" | "expires_on"
        >
      >(checks),
    policyReviews:
      rows<Pick<PolicyReviewRow, "id" | "title" | "next_review_on">>(reviews),
    stored: storedLines,
  });
}
