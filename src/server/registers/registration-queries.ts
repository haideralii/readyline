import "server-only";
/**
 * Reads for the registration period (REQ-023 Session A): the current period
 * is the row with the latest start date; the job's two lookups for the once
 * rule and the last-call exception read the reminders and the audit log.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  renewalWindowOpens,
  type RegistrationPeriod,
} from "@/lib/registers/timeline";
import type { ReminderKind } from "@/lib/registers/types";

// REQ-023 Session C (FR-7, D-2316): the renewal's five facts ride the same row.
const COLUMNS =
  "id, period_starts_on, period_ends_on, audit_type, midterm_applies, midterm_exempt_reason, midterm_start_by_override, midterm_override_source, last_audit_on, midterm_audit_on, application_submitted_on, scope_received_on, audit_booked_on, auditor_business_name, decision_received_on, what_changed_read_at";

export async function currentPeriod(
  supabase: SupabaseClient,
  accountId: string,
): Promise<RegistrationPeriod | null> {
  const r = await supabase
    .from("registration_periods")
    .select(COLUMNS)
    .eq("account_id", accountId)
    .order("period_starts_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (r.data as RegistrationPeriod | null) ?? null;
}

export async function listPeriods(
  supabase: SupabaseClient,
  accountId: string,
): Promise<RegistrationPeriod[]> {
  const r = await supabase
    .from("registration_periods")
    .select(COLUMNS)
    .eq("account_id", accountId)
    .order("period_starts_on", { ascending: false })
    .limit(50);
  return (r.data as RegistrationPeriod[] | null) ?? [];
}

/** The timeline kinds already sent for this period: never sent again on a new date (the once rule). */
export async function sentRegistrationKinds(
  admin: SupabaseClient,
  periodId: string,
): Promise<ReminderKind[]> {
  const r = await admin
    .from("reminders")
    .select("kind")
    .eq("subject_table", "registration_periods")
    .eq("subject_id", periodId)
    .not("sent_at", "is", null)
    .limit(100);
  return [
    ...new Set(
      ((r.data as { kind: ReminderKind }[] | null) ?? []).map((x) => x.kind),
    ),
  ];
}

/**
 * Finding 77: the last call is not sent when the period end was changed after
 * the window opened; read from the audit line the save writes (FR-1), never
 * from a stored flag.
 */
export async function periodEndChangedInsideWindow(
  admin: SupabaseClient,
  accountId: string,
  period: RegistrationPeriod,
): Promise<boolean> {
  const r = await admin
    .from("audit_log")
    .select("id")
    .eq("account_id", accountId)
    .eq("action", "registration.period.updated")
    .like("target", "period_ends_on %")
    .gte("at", `${renewalWindowOpens(period)}T00:00:00Z`)
    .limit(1);
  return ((r.data as unknown[] | null) ?? []).length > 0;
}
