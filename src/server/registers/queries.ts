import "server-only";
/**
 * Reads for the register pages (REQ-009 Session B, FR-5), with the user's
 * session so RLS applies; the status views compute the status for the tag.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { auditorVisibleIncidents } from "@/lib/registers/audit-pack";
import type {
  ComplaintEventRow,
  ComplaintRow,
  IncidentEventRow,
  IncidentRow,
  PolicyReviewRow,
  WorkerClearanceRow,
} from "@/lib/registers/types";
import type {
  ClearanceStatus,
  IncidentNotificationStatus,
  ReviewStatus,
} from "@/lib/registers/status";

export type IncidentListRow = IncidentRow & {
  notification_status: IncidentNotificationStatus | IncidentRow["status"];
};
export type WorkerCheckListRow = WorkerClearanceRow & {
  status: ClearanceStatus;
};
export type PolicyReviewListRow = PolicyReviewRow & { status: ReviewStatus };

const LIMIT = 500;

export async function hasActiveSubscription(
  supabase: SupabaseClient,
  accountId: string,
): Promise<boolean> {
  const r = await supabase.rpc("has_active_subscription", {
    p_account: accountId,
  });
  return r.data === true;
}

export async function listIncidents(
  supabase: SupabaseClient,
  accountId: string,
): Promise<IncidentListRow[]> {
  const r = await supabase
    .from("incidents_status")
    .select("*")
    .eq("account_id", accountId)
    .order("occurred_on", { ascending: false })
    .order("reference", { ascending: false })
    .limit(LIMIT);
  return (r.data as IncidentListRow[] | null) ?? [];
}

export async function getIncident(
  supabase: SupabaseClient,
  accountId: string,
  id: string,
): Promise<{ row: IncidentListRow; events: IncidentEventRow[] } | null> {
  const r = await supabase
    .from("incidents_status")
    .select("*")
    .eq("account_id", accountId)
    .eq("id", id)
    .maybeSingle();
  if (!r.data) return null;
  const ev = await supabase
    .from("incident_events")
    .select("*")
    .eq("incident_id", id)
    .order("at", { ascending: true })
    .limit(LIMIT);
  return {
    row: r.data as IncidentListRow,
    events: (ev.data as IncidentEventRow[] | null) ?? [],
  };
}

export async function listComplaints(
  supabase: SupabaseClient,
  accountId: string,
): Promise<ComplaintRow[]> {
  const r = await supabase
    .from("complaints")
    .select("*")
    .eq("account_id", accountId)
    .order("received_on", { ascending: false })
    .order("reference", { ascending: false })
    .limit(LIMIT);
  return (r.data as ComplaintRow[] | null) ?? [];
}

export async function getComplaint(
  supabase: SupabaseClient,
  accountId: string,
  id: string,
): Promise<{ row: ComplaintRow; events: ComplaintEventRow[] } | null> {
  const r = await supabase
    .from("complaints")
    .select("*")
    .eq("account_id", accountId)
    .eq("id", id)
    .maybeSingle();
  if (!r.data) return null;
  const ev = await supabase
    .from("complaint_events")
    .select("*")
    .eq("complaint_id", id)
    .order("at", { ascending: true })
    .limit(LIMIT);
  return {
    row: r.data as ComplaintRow,
    events: (ev.data as ComplaintEventRow[] | null) ?? [],
  };
}

export async function listWorkerChecks(
  supabase: SupabaseClient,
  accountId: string,
): Promise<WorkerCheckListRow[]> {
  const r = await supabase
    .from("worker_clearances_status")
    .select("*")
    .eq("account_id", accountId)
    .order("expires_on", { ascending: true, nullsFirst: false })
    .order("worker_ref", { ascending: true })
    .limit(LIMIT);
  return (r.data as WorkerCheckListRow[] | null) ?? [];
}

export async function getWorkerCheck(
  supabase: SupabaseClient,
  accountId: string,
  id: string,
): Promise<WorkerCheckListRow | null> {
  const r = await supabase
    .from("worker_clearances_status")
    .select("*")
    .eq("account_id", accountId)
    .eq("id", id)
    .maybeSingle();
  return (r.data as WorkerCheckListRow | null) ?? null;
}

export async function listPolicyReviews(
  supabase: SupabaseClient,
  accountId: string,
): Promise<PolicyReviewListRow[]> {
  const r = await supabase
    .from("policy_reviews_status")
    .select("*")
    .eq("account_id", accountId)
    .order("next_review_on", { ascending: true, nullsFirst: false })
    .order("title", { ascending: true })
    .limit(LIMIT);
  return (r.data as PolicyReviewListRow[] | null) ?? [];
}

export async function getPolicyReview(
  supabase: SupabaseClient,
  accountId: string,
  id: string,
): Promise<PolicyReviewListRow | null> {
  const r = await supabase
    .from("policy_reviews_status")
    .select("*")
    .eq("account_id", accountId)
    .eq("id", id)
    .maybeSingle();
  return (r.data as PolicyReviewListRow | null) ?? null;
}

/** The reference a reminder names (SR-4): INC-0004, CMP-0002, W-003, the policy's document id, or the business. */
export async function reminderReference(
  supabase: SupabaseClient,
  r: { subject_table: string; subject_id: string },
  tradingName: string,
): Promise<string> {
  if (r.subject_table === "accounts") return tradingName;
  const column =
    r.subject_table === "worker_clearances"
      ? "worker_ref"
      : r.subject_table === "policy_reviews"
        ? "document_type_id"
        : "reference";
  const row = await supabase
    .from(r.subject_table)
    .select(column)
    .eq("id", r.subject_id)
    .maybeSingle();
  return (
    ((row.data as Record<string, string> | null)?.[column] ?? "") ||
    r.subject_id.slice(0, 8)
  );
}

/** The overdue counts for the index and the account page ready line (FR-5, batch 28 item 4). */
export async function registerOverview(
  supabase: SupabaseClient,
  accountId: string,
): Promise<{
  incidents: { total: number; open: number; overdueNotification: number };
  complaints: { total: number; unresolved: number };
  workerChecks: { total: number; expiring: number; expired: number };
  policyReviews: {
    total: number;
    dueSoon: number;
    overdue: number;
    notAdopted: number;
  };
}> {
  const [all, c, w, p] = await Promise.all([
    listIncidents(supabase, accountId),
    listComplaints(supabase, accountId),
    listWorkerChecks(supabase, accountId),
    listPolicyReviews(supabase, accountId),
  ]);
  // REQ-020 FR-5: a report counts in the register only once the owner confirms
  // it; a rejected one never does, except one in a reportable category, which
  // stays as received, not recorded, with its clock (retro finding 62, D-2244).
  const i = auditorVisibleIncidents(all);
  return {
    incidents: {
      total: i.length,
      open: i.filter((x) => x.status === "open" || x.status === "under-review")
        .length,
      overdueNotification: i.filter(
        (x) => x.notification_status === "overdue-notification",
      ).length,
    },
    complaints: {
      total: c.length,
      unresolved: c.filter((x) => !["resolved", "withdrawn"].includes(x.status))
        .length,
    },
    workerChecks: {
      total: w.length,
      expiring: w.filter((x) => x.status === "expiring").length,
      expired: w.filter((x) => x.status === "expired").length,
    },
    policyReviews: {
      total: p.length,
      dueSoon: p.filter((x) => x.status === "due-soon").length,
      overdue: p.filter((x) => x.status === "overdue").length,
      notAdopted: p.filter((x) => x.status === "not-adopted").length,
    },
  };
}

/**
 * True once the checklist's Done has set the policy review's adopted date
 * for this document type (REQ-016 D-058): the download then serves the
 * document without the draft marks. Reads with the user's session (RLS).
 */
export async function isDocumentAdopted(
  supabase: SupabaseClient,
  accountId: string,
  documentTypeId: string,
): Promise<boolean> {
  const r = await supabase
    .from("policy_reviews")
    .select("adopted_on")
    .eq("account_id", accountId)
    .eq("document_type_id", documentTypeId)
    .not("adopted_on", "is", null)
    .limit(1)
    .maybeSingle();
  return Boolean(r.data?.adopted_on);
}
