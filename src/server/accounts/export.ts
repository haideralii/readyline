/**
 * Account data export (REQ-004 FR-6, AC-4). Everything is read with the
 * owner's own session, so row-level security guarantees the export can only
 * contain that account's rows. The zip is built in memory; the account holds
 * only business data, so it is small.
 *
 * Retro review of REQ-004 (15 Oct 2026, finding 32, PO decision): the zip is
 * the CLAUDE.md 4.5 export and must be complete, so every table the owner
 * can read is in it, one JSON file per table, each query scoped by
 * `account_id`. `account.json` keeps its original shape (account,
 * memberships, questionnaire draft, checklist, audit log); the registers,
 * document metadata, purchases, subscriptions, entitlements, facts and
 * reminders are their own files. Hidden columns (`token_hash`, document
 * contents) never leave the database; see `EXPORT_TABLES` and
 * `HIDDEN_COLUMNS`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { strToU8, zipSync } from "fflate";
import { BRAND } from "@/lib/brand";

export type AccountExport = {
  exportedAt: string;
  product: string;
  account: Record<string, unknown>;
  memberships: Record<string, unknown>[];
  questionnaireDraft: Record<string, unknown> | null;
  /** REQ-006 SR-1: the checklist statuses and notes the provider set. */
  checklistItems: Record<string, unknown>[];
  auditLog: Record<string, unknown>[];
  /** Finding 32: every other owner-readable table, keyed by table name. */
  tables: Record<string, Record<string, unknown>[]>;
};

export type ExportTable = {
  /** The Postgres table; also the zip entry name (`<table>.json`). */
  table: string;
  /** Columns to read; `*` where every column is the provider's own data. */
  select: string;
  /** The column the rows are sorted by in the file. */
  orderBy: string;
  /** One line for the README. */
  describe: string;
};

/**
 * Columns that are never exported whatever table they sit in: secrets and
 * link tokens are the product's, not the provider's. Applied to every row
 * after the read, so a `*` select cannot leak one that a later migration adds.
 */
export const HIDDEN_COLUMNS: readonly string[] = ["token_hash"];

/**
 * Every owner-readable table outside `account.json`, scoped by `account_id`.
 * Document contents are not here: `document_versions` is listed without its
 * `model` column and the files themselves are in the set's zip.
 */
export const EXPORT_TABLES: readonly ExportTable[] = [
  // REQ-009 registers and their event tables.
  {
    table: "incidents",
    select: "*",
    orderBy: "created_at",
    describe: "incident register rows (reference codes only, never names).",
  },
  {
    table: "incident_events",
    select: "*",
    orderBy: "at",
    describe: "the notes and status changes on each incident.",
  },
  {
    table: "complaints",
    select: "*",
    orderBy: "created_at",
    describe: "complaints register rows.",
  },
  {
    table: "complaint_events",
    select: "*",
    orderBy: "at",
    describe: "the notes and status changes on each complaint.",
  },
  {
    table: "worker_clearances",
    select: "*",
    orderBy: "created_at",
    describe: "worker screening and training clearances by worker code.",
  },
  {
    table: "policy_reviews",
    select: "*",
    orderBy: "created_at",
    describe: "policy review dates and cycles.",
  },
  // REQ-018 audit-day registers.
  {
    table: "corporate_risks",
    select: "*",
    orderBy: "created_at",
    describe: "corporate risk register rows.",
  },
  {
    table: "participant_risks",
    select: "*",
    orderBy: "created_at",
    describe: "participant risk register rows (participant codes only).",
  },
  {
    table: "conflicts_of_interest",
    select: "*",
    orderBy: "created_at",
    describe: "conflict of interest register rows.",
  },
  {
    table: "delegations",
    select: "*",
    orderBy: "created_at",
    describe: "delegations and backups by role.",
  },
  {
    table: "insurance_items",
    select: "*",
    orderBy: "created_at",
    describe: "insurance, registration and licence expiry rows.",
  },
  {
    table: "improvements",
    select: "*",
    orderBy: "created_at",
    describe: "continuous improvement register rows.",
  },
  {
    table: "staff_matrix",
    select: "*",
    orderBy: "created_at",
    describe: "staff matrix rows by worker code.",
  },
  {
    table: "onboarding_checklists",
    select: "*",
    orderBy: "created_at",
    describe: "worker and participant onboarding checklists.",
  },
  {
    table: "onboarding_ticks",
    select: "*",
    orderBy: "created_at",
    describe: "the ticks on each onboarding checklist.",
  },
  {
    table: "decisions",
    select: "*",
    orderBy: "created_at",
    describe: "decisions register rows.",
  },
  {
    table: "register_events",
    select: "*",
    orderBy: "at",
    describe: "the notes and review events on the audit-day registers.",
  },
  // Document metadata (REQ-005): no contents.
  {
    table: "version_sets",
    select:
      "id, created_by, answers_snapshot_hash, derived_result, status, document_count, fallback_section_count, generated_count, provider_input_section_count, created_at, completed_at",
    orderBy: "created_at",
    describe:
      "each generated document set: when it was made, from which answers, and its counts.",
  },
  {
    table: "document_versions",
    select: "id, version_set_id, document_type_id, version, status, created_at",
    orderBy: "created_at",
    describe:
      "each document's type, version and status. The documents themselves are not in this file: download the set's zip from your documents page.",
  },
  // Payments (REQ-007).
  {
    table: "purchases",
    select: "*",
    orderBy: "created_at",
    describe: "one-off purchases with Stripe ids and receipt links.",
  },
  {
    table: "subscriptions",
    select: "*",
    orderBy: "created_at",
    describe: "the subscription record as Stripe reports it.",
  },
  {
    table: "entitlements",
    select: "*",
    orderBy: "granted_at",
    describe: "what the account is entitled to and since when.",
  },
  // The facts the Finish form writes (REQ-010).
  {
    table: "account_facts",
    select: "*",
    orderBy: "key",
    describe: "the business facts you filled in to finish your documents.",
  },
  // Reminders (REQ-009).
  {
    table: "reminders",
    select: "*",
    orderBy: "created_at",
    describe: "the reminders scheduled and sent for the account.",
  },
];

export function exportTableFileName(table: string): string {
  return `${table}.json`;
}

export function stripHiddenColumns(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (HIDDEN_COLUMNS.includes(key)) continue;
    out[key] = value;
  }
  return out;
}

/** Returns null when the account is not visible to this session (not a member, or deleted). */
export async function buildAccountExport(
  supabase: SupabaseClient,
  accountId: string,
  now: Date = new Date(),
): Promise<AccountExport | null> {
  const account = await supabase
    .from("accounts")
    .select(
      "id, trading_name, business_structure, states, abn, registration_date, registration_kind, last_emergency_drill_on, created_at, updated_at",
    )
    .eq("id", accountId)
    .maybeSingle();
  if (account.error || !account.data) return null;

  const [memberships, draft, checklist, audit] = await Promise.all([
    supabase
      .from("memberships")
      .select("user_id, role, worker_ref, created_at")
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
  ]);

  // Every other owner-readable table, each scoped by account_id; RLS bounds
  // the rows further to what this session may see.
  const tableReads = await Promise.all(
    EXPORT_TABLES.map((spec) =>
      supabase
        .from(spec.table)
        .select(spec.select)
        .eq("account_id", accountId)
        .order(spec.orderBy, { ascending: true }),
    ),
  );
  const tables: Record<string, Record<string, unknown>[]> = {};
  EXPORT_TABLES.forEach((spec, i) => {
    // A select built from a string is opaque to the PostgREST type parser.
    const rows = (tableReads[i]?.data ?? []) as unknown as Record<
      string,
      unknown
    >[];
    tables[spec.table] = rows.map(stripHiddenColumns);
  });

  return {
    exportedAt: now.toISOString(),
    product: BRAND,
    account: stripHiddenColumns(account.data),
    memberships: (memberships.data ?? []).map(stripHiddenColumns),
    questionnaireDraft: draft.data ? stripHiddenColumns(draft.data) : null,
    checklistItems: (checklist.data ?? []).map(stripHiddenColumns),
    auditLog: (audit.data ?? []).map(stripHiddenColumns),
    tables,
  };
}

export function exportFileName(now: Date): string {
  return `${BRAND.toLowerCase()}-export-${now.toISOString().slice(0, 10)}.zip`;
}

export function buildExportZip(data: AccountExport): Uint8Array {
  const { tables, ...accountJson } = data;
  const readme = [
    `${BRAND} account export`,
    "",
    `Exported at ${data.exportedAt}.`,
    "Files:",
    "  account.json: your business details, memberships, questionnaire draft, readiness checklist statuses and notes, and audit log as JSON.",
    ...EXPORT_TABLES.map(
      (spec) => `  ${exportTableFileName(spec.table)}: ${spec.describe}`,
    ),
    "",
    "This export holds your provider business data only. It never contains participant information,",
    "because the product does not collect any.",
    `${BRAND} provides general information and document templates for your own review; it is not legal advice.`,
    "",
  ].join("\n");
  const files: Record<string, Uint8Array> = {
    "account.json": strToU8(JSON.stringify(accountJson, null, 2)),
  };
  for (const spec of EXPORT_TABLES) {
    files[exportTableFileName(spec.table)] = strToU8(
      JSON.stringify(tables[spec.table] ?? [], null, 2),
    );
  }
  files["README.txt"] = strToU8(readme);
  return zipSync(files, { level: 6 });
}
