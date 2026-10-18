/**
 * Account data export (REQ-004 FR-6, AC-4). Everything is read with the
 * owner's own session, so row-level security guarantees the export can only
 * contain that account's rows. The zip is built in memory; the account holds
 * only business data, so it is small.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { strToU8, zipSync } from "fflate";
import { BRAND } from "@/lib/brand";
import { CSV_COLUMNS, toCsv } from "@/lib/registers/csv";

/**
 * REQ-024 FR-6c (D-2415; SR-8(m)): the worker tables the export carries as
 * CSV, every one the product holds about workers, read with the owner's
 * session under RLS and regardless of the subscription's state (the gate
 * applies to writes and the fill, never to reads or to this export).
 * Session B added `policy_acknowledgements` and Session C
 * `supervision_entries`, so both are here (FR-6c names the seven).
 */
export const WORKER_EXPORT_TABLES = [
  "staff_matrix",
  "onboarding_checklists",
  "onboarding_items",
  "onboarding_ticks",
  "worker_clearances",
  "risk_assessed_roles",
  "screening_exceptions",
  "policy_acknowledgements",
  "supervision_entries",
] as const;
export type WorkerExportTable = (typeof WORKER_EXPORT_TABLES)[number];

/** The owner's own export keeps the note columns the pack leaves out. */
const WITH_NOTE: readonly WorkerExportTable[] = [
  "staff_matrix",
  "onboarding_items",
  "worker_clearances",
];

export function workerExportColumns(table: WorkerExportTable): string[] {
  const base = [...CSV_COLUMNS[table]] as string[];
  return WITH_NOTE.includes(table) ? [...base, "note"] : base;
}

export type AccountExport = {
  exportedAt: string;
  product: string;
  account: Record<string, unknown>;
  memberships: Record<string, unknown>[];
  questionnaireDraft: Record<string, unknown> | null;
  /** REQ-006 SR-1: the checklist statuses and notes the provider set. */
  checklistItems: Record<string, unknown>[];
  auditLog: Record<string, unknown>[];
  /** REQ-023 FR-2 (finding 66): the registration periods, dates as typed. */
  registrationPeriods: Record<string, unknown>[];
  /** REQ-024 FR-6c: the worker tables, as stored, each a CSV in the zip. */
  workerTables: Record<WorkerExportTable, Record<string, unknown>[]>;
  /** REQ-030 D-2898, REQ-029 SR-5: the account's own facts that fill the documents (key, value, when). */
  accountFacts: Record<string, unknown>[];
  /** REQ-029 SR-5: every document version's adoption snapshot (approver and day). */
  documentVersions: Record<string, unknown>[];
  /** REQ-030 D-2898: the reviews of changed documents (REQ-024). */
  documentChangeReviews: Record<string, unknown>[];
  /** REQ-030 D-2898: the policies circulated to workers, by code and date. */
  policyCirculations: Record<string, unknown>[];
  /** REQ-030 D-2898: the purchase records the privacy page says we keep. */
  purchases: Record<string, unknown>[];
  subscriptions: Record<string, unknown>[];
  entitlements: Record<string, unknown>[];
  /** REQ-033 FR-3 (D-2932): the audit findings, in the provider's words. */
  findings: Record<string, unknown>[];
  /** REQ-035 FR-4, SR-3 (D-2962): the gap checks' lists; never the documents they were run on. */
  gapChecks: Record<string, unknown>[];
  gapCheckSections: Record<string, unknown>[];
};

/** Returns null when the account is not visible to this session (not a member, or deleted). */
export async function buildAccountExport(
  supabase: SupabaseClient,
  accountId: string,
  now: Date = new Date(),
): Promise<AccountExport | null> {
  const account = await supabase
    .from("accounts")
    .select(
      "id, trading_name, business_structure, states, abn, created_at, updated_at",
    )
    .eq("id", accountId)
    .maybeSingle();
  if (account.error || !account.data) return null;

  const [
    memberships,
    draft,
    checklist,
    audit,
    periods,
    facts,
    documentVersions,
    changeReviews,
    circulations,
    purchases,
    subscriptions,
    entitlements,
    findings,
    gapChecks,
    gapCheckSections,
    ...workers
  ] = await Promise.all([
    supabase
      .from("memberships")
      .select("user_id, role, created_at")
      .eq("account_id", accountId),
    supabase
      .from("questionnaire_drafts")
      .select("answers, answers_version, current_step, updated_at")
      .eq("account_id", accountId)
      .maybeSingle(),
    supabase
      .from("checklist_items")
      .select("item_id, status, note, updated_at")
      .eq("account_id", accountId)
      .order("item_id", { ascending: true }),
    supabase
      .from("audit_log")
      .select("id, actor_user_id, action, target, at")
      .eq("account_id", accountId)
      .order("at", { ascending: true }),
    // REQ-023 FR-2 (finding 66): the registration periods, dates as typed.
    supabase
      .from("registration_periods")
      .select(
        "id, period_starts_on, period_ends_on, audit_type, midterm_applies, midterm_exempt_reason, midterm_start_by_override, midterm_override_source, last_audit_on, midterm_audit_on, created_at, updated_at",
      )
      .eq("account_id", accountId)
      .order("period_starts_on", { ascending: true }),
    // REQ-030 FR-5 (D-2898): the six tables the PO moved into the export,
    // read with the owner's session under RLS like everything above;
    // ids that only join rows on the server stay out.
    supabase
      .from("account_facts")
      .select("key, value, created_at, updated_at")
      .eq("account_id", accountId)
      .order("key", { ascending: true }),
    // REQ-029 SR-5 (D-2859): the snapshots the downloads fill from.
    supabase
      .from("document_versions")
      .select(
        "version_set_id, document_type_id, version, status, adopted_on, approver_name, approver_role, created_at",
      )
      .eq("account_id", accountId)
      .order("created_at", { ascending: true }),
    supabase
      .from("document_change_reviews")
      .select(
        "document_type_id, change_id, reviewed_on, reviewer_ref, note, created_at",
      )
      .eq("account_id", accountId)
      .order("created_at", { ascending: true }),
    supabase
      .from("policy_circulations")
      .select("document_type_id, circulated_on, worker_refs, how, created_at")
      .eq("account_id", accountId)
      .order("created_at", { ascending: true }),
    supabase
      .from("purchases")
      .select(
        "stripe_checkout_session_id, stripe_payment_intent_id, amount_cents, currency, status, receipt_url, created_at, refunded_at",
      )
      .eq("account_id", accountId)
      .order("created_at", { ascending: true }),
    supabase
      .from("subscriptions")
      .select(
        "stripe_subscription_id, status, current_period_end, created_at, updated_at",
      )
      .eq("account_id", accountId)
      .order("created_at", { ascending: true }),
    supabase
      .from("entitlements")
      .select("kind, assessment_id, granted_at, revoked_at")
      .eq("account_id", accountId)
      .order("granted_at", { ascending: true }),
    // REQ-033 FR-3 (D-2932): the findings register, as stored.
    supabase
      .from("findings")
      .select(
        "reference, standard_id, indicator, severity, finding, due_on, status, addressed_on, addressed_by_role, verified_on, created_at, updated_at",
      )
      .eq("account_id", accountId)
      .order("created_at", { ascending: true }),
    // REQ-035 FR-4 (D-2962): the gap checks and their section lists, as stored.
    supabase
      .from("gap_checks")
      .select(
        "id, document_type_id, title, covered, partly, missing, prompt_version, created_at",
      )
      .eq("account_id", accountId)
      .order("created_at", { ascending: true }),
    supabase
      .from("gap_check_sections")
      .select(
        "gap_check_id, section_id, number, heading, position, state, reason, standard_ids, indicator_labels, created_at",
      )
      .eq("account_id", accountId)
      .order("created_at", { ascending: true }),
    ...WORKER_EXPORT_TABLES.map((table) =>
      supabase
        .from(table)
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: true }),
    ),
  ]);
  // The items and ticks are keyed by their checklist; the export names the worker.
  const workerTables = Object.fromEntries(
    WORKER_EXPORT_TABLES.map((table, i) => [
      table,
      (workers[i].data as Record<string, unknown>[] | null) ?? [],
    ]),
  ) as Record<WorkerExportTable, Record<string, unknown>[]>;
  const refByChecklist = new Map(
    workerTables.onboarding_checklists.map((c) => [
      c.id as string,
      c.subject_ref as string,
    ]),
  );
  for (const table of ["onboarding_items", "onboarding_ticks"] as const)
    workerTables[table] = workerTables[table].map((r) => ({
      worker_ref: refByChecklist.get(r.checklist_id as string) ?? "",
      ...r,
    }));

  return {
    exportedAt: now.toISOString(),
    product: BRAND,
    account: account.data,
    memberships: memberships.data ?? [],
    questionnaireDraft: draft.data ?? null,
    checklistItems: checklist.data ?? [],
    auditLog: audit.data ?? [],
    registrationPeriods: periods.data ?? [],
    workerTables,
    accountFacts: facts.data ?? [],
    documentVersions:
      (documentVersions.data as Record<string, unknown>[] | null) ?? [],
    documentChangeReviews: changeReviews.data ?? [],
    policyCirculations: circulations.data ?? [],
    purchases: purchases.data ?? [],
    subscriptions: subscriptions.data ?? [],
    entitlements: entitlements.data ?? [],
    findings: (findings.data as Record<string, unknown>[] | null) ?? [],
    gapChecks: (gapChecks.data as Record<string, unknown>[] | null) ?? [],
    gapCheckSections:
      (gapCheckSections.data as Record<string, unknown>[] | null) ?? [],
  };
}

export function exportFileName(now: Date): string {
  return `${BRAND.toLowerCase()}-export-${now.toISOString().slice(0, 10)}.zip`;
}

export function buildExportZip(data: AccountExport): Uint8Array {
  const readme = [
    `${BRAND} account export`,
    "",
    `Exported at ${data.exportedAt}.`,
    "Files:",
    "  account.json: your business details, memberships, questionnaire draft, readiness checklist statuses and notes, registration periods, the worker tables, the facts that fill your documents, each document version's approver and adoption day, document change reviews, policy circulations, purchases, subscriptions, entitlements, your audit findings, your gap checks' lists and audit log as JSON.",
    "  registers/<table>.csv: the worker tables (staff matrix, onboarding checklists, items and ticks, worker checks, risk assessed roles, screening exceptions) as CSV, codes and numbers as you typed them.",
    "",
    "This export holds your provider business data only. It never contains participant information,",
    "because the product does not collect any.",
    `${BRAND} provides general information and document templates for your own review; it is not legal advice.`,
    "",
  ].join("\n");
  const files: Record<string, Uint8Array> = {
    "account.json": strToU8(JSON.stringify(data, null, 2)),
    "README.txt": strToU8(readme),
  };
  for (const table of WORKER_EXPORT_TABLES)
    files[`registers/${table}.csv`] = strToU8(
      toCsv(workerExportColumns(table), data.workerTables?.[table] ?? []),
    );
  return zipSync(files, { level: 6 });
}
