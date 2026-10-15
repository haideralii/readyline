import "server-only";
/**
 * The nightly reminders job (REQ-009 FR-3, SR-4, AC-4): for every account
 * with registers or a registration date, compute what falls due today
 * (plus the catch-up window), insert the rows the key does not already
 * hold, then send the unsent rows by email to the account owner, naming
 * the register and the reference only. Runs with the secret key; the route
 * guards it with CRON_SECRET and the production-only rule.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "@/lib/logging/logger";
import {
  dueReminders,
  reminderLine,
  type ReminderDue,
} from "@/lib/registers/reminders";
import type { ReminderKind } from "@/lib/registers/types";
import type { EmailProvider } from "@/server/email/provider";
import { remindersEmail } from "@/server/email/templates";

export type RemindersReport = {
  accounts: number;
  computed: number;
  inserted: number;
  emailed: number;
  errors: string[];
};

type AccountRow = {
  id: string;
  trading_name: string;
  registration_date: string | null;
  registration_kind: "certification" | "verification" | null;
  /** REQ-018 FR-10: the last emergency drill, recorded on the audit-day page. */
  last_emergency_drill_on: string | null;
};

async function accountsWithRegisters(
  admin: SupabaseClient,
): Promise<AccountRow[]> {
  const ids = new Set<string>();
  for (const table of [
    "incidents",
    "complaints",
    "worker_clearances",
    "policy_reviews",
    // REQ-018 Session C: the audit-day registers that send reminders (D-1905).
    "insurance_items",
    "staff_matrix",
    "participant_risks",
    "corporate_risks",
    "conflicts_of_interest",
    // REQ-020 FR-7.
    "hazards",
  ]) {
    const r = await admin.from(table).select("account_id").limit(10_000);
    for (const row of (r.data as { account_id: string }[] | null) ?? [])
      ids.add(row.account_id);
  }
  const dated = await admin
    .from("accounts")
    .select("id")
    .or("registration_date.not.is.null,last_emergency_drill_on.not.is.null")
    .is("deleted_at", null)
    .limit(10_000);
  for (const row of (dated.data as { id: string }[] | null) ?? [])
    ids.add(row.id);
  if (ids.size === 0) return [];
  const r = await admin
    .from("accounts")
    .select(
      "id, trading_name, registration_date, registration_kind, last_emergency_drill_on",
    )
    .in("id", [...ids])
    .is("deleted_at", null);
  return (r.data as AccountRow[] | null) ?? [];
}

/** What is due for one account on `today`, from the live rows. */
export async function computeAccountReminders(
  admin: SupabaseClient,
  account: AccountRow,
  today: string,
): Promise<ReminderDue[]> {
  // REQ-018 Session C (D-1905): the audit-day registers that send reminders.
  const [insurance, staff, participants, corporate, conflicts, hazards] =
    await Promise.all([
      admin
        .from("insurance_items")
        .select("id, expires_on")
        .eq("account_id", account.id),
      admin
        .from("staff_matrix")
        .select("id, last_supervision_on, last_appraisal_on")
        .eq("account_id", account.id),
      admin
        .from("participant_risks")
        .select("id, support_plan_review_on, review_on")
        .eq("account_id", account.id),
      admin
        .from("corporate_risks")
        .select("id, review_on")
        .eq("account_id", account.id),
      admin
        .from("conflicts_of_interest")
        .select("id, review_on")
        .eq("account_id", account.id),
      // REQ-020 FR-7: the hazard register's review dates.
      admin
        .from("hazards")
        .select("id, review_on")
        .eq("account_id", account.id),
    ]);
  const rows = <T>(r: { data: unknown }) => (r.data as T[] | null) ?? [];
  const auditDay = {
    insuranceItems: rows<{ id: string; expires_on: string }>(insurance),
    staff: rows<{
      id: string;
      last_supervision_on: string | null;
      last_appraisal_on: string | null;
    }>(staff),
    participantRisks: rows<{
      id: string;
      support_plan_review_on: string | null;
      review_on: string;
    }>(participants),
    reviewRows: [
      ...rows<{ id: string; review_on: string }>(corporate).map((r) => ({
        id: r.id,
        table: "corporate_risks" as const,
        review_on: r.review_on,
      })),
      ...rows<{ id: string; review_on: string }>(conflicts).map((r) => ({
        id: r.id,
        table: "conflicts_of_interest" as const,
        review_on: r.review_on,
      })),
      ...rows<{ id: string; review_on: string }>(participants).map((r) => ({
        id: r.id,
        table: "participant_risks" as const,
        review_on: r.review_on,
      })),
      ...rows<{ id: string; review_on: string }>(hazards).map((r) => ({
        id: r.id,
        table: "hazards" as const,
        review_on: r.review_on,
      })),
    ],
    lastEmergencyDrillOn: account.last_emergency_drill_on,
  };
  const [inc, ev, comp, checks, reviews] = await Promise.all([
    admin
      .from("incidents")
      .select(
        "id, status, reportable, notify_by, reportable_notified_on, reported_on, aware_at",
      )
      .eq("account_id", account.id),
    admin
      .from("incident_events")
      .select("incident_id, at")
      .eq("account_id", account.id)
      .order("at", { ascending: false })
      .limit(5000),
    admin
      .from("complaints")
      .select("id, status, received_on, acknowledged_on")
      .eq("account_id", account.id),
    admin
      .from("worker_clearances")
      .select("id, expires_on")
      .eq("account_id", account.id),
    admin
      .from("policy_reviews")
      .select("id, next_review_on")
      .eq("account_id", account.id),
  ]);
  const lastEvent = new Map<string, string>();
  for (const e of (ev.data as { incident_id: string; at: string }[] | null) ??
    [])
    if (!lastEvent.has(e.incident_id))
      lastEvent.set(e.incident_id, e.at.slice(0, 10));
  // REQ-020 FR-5: a draft report raises only the nudge to confirm it; it joins
  // the incident rules once confirmed. A rejected report raises nothing.
  const incidentRows =
    (inc.data as
      | {
          id: string;
          status: "draft" | "open" | "under-review" | "closed" | "rejected";
          reportable: boolean;
          notify_by: string | null;
          reportable_notified_on: string | null;
          reported_on: string;
          aware_at: string;
        }[]
      | null) ?? [];
  return dueReminders({
    today,
    now: new Date().toISOString(),
    account: {
      id: account.id,
      registration_date: account.registration_date,
      registration_kind: account.registration_kind,
    },
    reports: incidentRows
      .filter((i) => i.status === "draft")
      .map((i) => ({ id: i.id, aware_at: i.aware_at })),
    incidents: incidentRows
      .filter(
        (i): i is typeof i & { status: "open" | "under-review" | "closed" } =>
          i.status !== "draft" && i.status !== "rejected",
      )
      .map((i) => ({
        ...i,
        last_activity_on: lastEvent.get(i.id) ?? i.reported_on,
      })),
    complaints:
      (comp.data as
        | {
            id: string;
            status: string;
            received_on: string;
            acknowledged_on: string | null;
          }[]
        | null) ?? [],
    workerChecks:
      (checks.data as { id: string; expires_on: string | null }[] | null) ?? [],
    policyReviews:
      (reviews.data as
        { id: string; next_review_on: string | null }[] | null) ?? [],
    ...auditDay,
  });
}

/** The reference shown for a reminder's subject: INC-0004, CMP-0002, W-003, the policy title, or the business. */
async function referenceFor(
  admin: SupabaseClient,
  r: { subject_table: string; subject_id: string },
  tradingName: string,
): Promise<string> {
  if (r.subject_table === "accounts") return tradingName;
  // REQ-018 Session C: the audit-day registers' references (a code, a label or an area), never content (SR-4).
  const column =
    r.subject_table === "worker_clearances" ||
    r.subject_table === "staff_matrix"
      ? "worker_ref"
      : r.subject_table === "policy_reviews"
        ? "document_type_id"
        : r.subject_table === "insurance_items"
          ? "label"
          : r.subject_table === "participant_risks"
            ? "participant_ref"
            : r.subject_table === "corporate_risks"
              ? "area"
              : r.subject_table === "conflicts_of_interest"
                ? "who_ref"
                : r.subject_table === "hazards"
                  ? "site_ref"
                  : "reference";
  const row = await admin
    .from(r.subject_table)
    .select(column)
    .eq("id", r.subject_id)
    .maybeSingle();
  return (
    ((row.data as Record<string, string> | null)?.[column] ?? "") ||
    r.subject_id.slice(0, 8)
  );
}

export async function runRemindersJob(input: {
  admin: SupabaseClient;
  email: EmailProvider;
  today: string;
  dryRun?: boolean;
  /** Resolves the owner's address; the job never reads auth tables itself in tests. */
  ownerEmail: (accountId: string) => Promise<string | null>;
  /**
   * Only these accounts (batch 41): the integration test shares its stack
   * with the other integration files' accounts, and the report's totals
   * must count the seeded account alone. The route never sets it.
   */
  accountIds?: readonly string[];
}): Promise<RemindersReport> {
  const report: RemindersReport = {
    accounts: 0,
    computed: 0,
    inserted: 0,
    emailed: 0,
    errors: [],
  };
  const only = input.accountIds ? new Set(input.accountIds) : null;
  const accounts = (await accountsWithRegisters(input.admin)).filter(
    (a) => !only || only.has(a.id),
  );
  report.accounts = accounts.length;
  for (const account of accounts) {
    try {
      const due = await computeAccountReminders(
        input.admin,
        account,
        input.today,
      );
      report.computed += due.length;
      if (input.dryRun || due.length === 0) continue;
      // The unique key (account, kind, subject, send_on) makes a second run a no-op (AC-4).
      const ins = await input.admin
        .from("reminders")
        .upsert(
          due.map((d) => ({ ...d, channel: "email" })),
          {
            onConflict: "account_id,kind,subject_id,send_on",
            ignoreDuplicates: true,
          },
        )
        .select("id");
      if (ins.error) throw new Error(ins.error.message);
      report.inserted += ins.data?.length ?? 0;
    } catch (e) {
      report.errors.push(
        `${account.id}: ${e instanceof Error ? e.message : String(e)}`,
      );
      log.warn("jobs.reminders.account-failed", { accountId: account.id });
    }
  }
  if (input.dryRun) return report;

  // Send everything unsent whose day has come, one email per account per run (SR-4: register and reference only).
  let unsentQuery = input.admin
    .from("reminders")
    .select("id, account_id, kind, subject_table, subject_id, due_on, send_on")
    .is("sent_at", null)
    .lte("send_on", input.today);
  if (input.accountIds)
    unsentQuery = unsentQuery.in("account_id", [...input.accountIds]);
  const unsent = await unsentQuery.order("account_id").limit(2000);
  const byAccount = new Map<string, typeof unsent.data>();
  for (const r of unsent.data ?? []) {
    const list = byAccount.get(r.account_id) ?? [];
    list.push(r);
    byAccount.set(r.account_id, list);
  }
  for (const [accountId, rows] of byAccount) {
    try {
      const account = accounts.find((a) => a.id === accountId);
      const to = await input.ownerEmail(accountId);
      if (!to || !rows) continue;
      const lines: string[] = [];
      for (const r of rows)
        lines.push(
          reminderLine(
            r.kind as ReminderKind,
            await referenceFor(
              input.admin,
              r,
              account?.trading_name ?? "your business",
            ),
            r.due_on,
          ),
        );
      await input.email.send(
        remindersEmail({ to, tradingName: account?.trading_name ?? "", lines }),
      );
      const ids = rows.map((r) => r.id);
      const up = await input.admin
        .from("reminders")
        .update({ sent_at: new Date().toISOString() })
        .in("id", ids);
      if (up.error) throw new Error(up.error.message);
      report.emailed += ids.length;
    } catch (e) {
      report.errors.push(
        `${accountId}: ${e instanceof Error ? e.message : String(e)}`,
      );
      log.warn("jobs.reminders.email-failed", { accountId });
    }
  }
  return report;
}
