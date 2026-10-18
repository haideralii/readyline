import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WORKER_EXPORT_TABLES } from "@/server/accounts/export";

/**
 * REQ-030 FR-5, AC-8 (D-2869): every table whose migration gives it an
 * `account_id` column is either in the account export, in the audit pack,
 * or named below with one line saying why it is the system's and not the
 * provider's record. A migration that adds a table none of the lists carries
 * fails here naming it, so a new record cannot slip past the data promises
 * (the privacy page's export and deletion sentences).
 */

/** Tables the account export writes (`src/server/accounts/export.ts`): the account's own rows and the worker tables. */
// The account row itself (`accounts`) has no account_id column; the export writes it as the first file.
const EXPORT_TABLES: readonly string[] = [
  "audit_log",
  "checklist_items",
  "memberships",
  "questionnaire_drafts",
  "registration_periods",
  ...WORKER_EXPORT_TABLES,
];

/** Tables the audit pack writes (`src/server/registers/audit-pack.ts` through the register files and the audit-day meta). */
const PACK_TABLES: readonly string[] = [
  "incidents",
  "complaints",
  "worker_clearances",
  "policy_reviews",
  "document_versions",
  "register_events",
  "self_checks",
  "improvements",
  "commission_changes",
  "conflicts_of_interest",
  "corporate_risks",
  "decisions",
  "delegations",
  "hazards",
  "insurance_items",
  "participant_risks",
  "staff_matrix",
  "onboarding_checklists",
];

/**
 * System tables, each with its one line (D-2869's allow-list). The REQ named
 * seven; `stripe_events` and `daily_counters` are not among them here because
 * neither has an account_id column (Stripe's event ids; counts by day), so
 * they are outside this test's reach.
 */
const SYSTEM_TABLES: Record<string, string> = {
  generation_quota: "The model-call budget per account; a limit, not a record.",
  register_sequences:
    "The next register reference per account; the references themselves are on the rows exported.",
  reminders:
    "The reminder queue; each row is derived from a register row the export and the pack carry.",
  imports:
    "Import receipts (file name, row counts); the rows they created are in the registers.",
  generation_log:
    "The model's prompt version, tokens and timing per document; the documents are in the pack.",
};

/**
 * Tables the first run found in no list (18 Oct 2026). Each waits for the PO's
 * decision per table (D-2869: the Dev reports them, the PO decides); it leaves
 * this list when it joins the export, the pack or SYSTEM_TABLES.
 */
const PENDING_PO_DECISION: Record<string, string> = {
  account_facts:
    "The account's own facts (owner name, role, approval date and the like) that fill the documents; recommended: the export.",
  auditor_links:
    "Auditor links: a token hash, the hours and the opens; recommended: system (the hash is useless to the provider; the opens are audit_log lines, exported).",
  complaint_events:
    "The complaints register's trail (the older per-register trail); recommended: the pack, beside register_events.",
  incident_events:
    "The incidents register's trail; recommended: the pack, beside register_events.",
  document_change_reviews:
    "A review of a changed document (REQ-024); recommended: the export.",
  entitlements:
    "What the account may use (pack, subscription) and since when; recommended: the export, as purchase records the privacy page says we keep.",
  purchases:
    "The Stripe purchase rows; recommended: the export (purchase records).",
  subscriptions:
    "The Stripe subscription state; recommended: the export (purchase records).",
  generation_jobs:
    "The paid generation job queue; recommended: system (a queue, not a record; the sets are the documents).",
  invitations:
    "Worker invitations: a hashed token, the worker code and the dates; recommended: system (the hash is useless; the membership that results is exported).",
  policy_circulations:
    "A policy circulated to workers with the date (REQ-024 B); recommended: the export, with the worker tables.",
  reminder_settings:
    "One row per account: do_not_send and the hashed unsubscribe token; recommended: system (the preference is on the account page; the hash is useless).",
  report_links:
    "Incident report links: a token hash and the dates; recommended: system.",
  version_sets:
    "The generated set's metadata (status, counts, storage prefix); recommended: system (the documents themselves are in the pack).",
};

/** Every `create table public.<name> (...)` whose body names an account_id column. */
export function accountTables(dir = "supabase/migrations"): string[] {
  const out = new Set<string>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
    const sql = readFileSync(join(dir, file), "utf8");
    const re =
      /create table (?:if not exists )?public\.([a-z_]+)\s*\(([\s\S]*?)\);/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql))) {
      if (/\baccount_id\b/.test(m[2])) out.add(m[1]);
    }
  }
  return [...out].sort();
}

describe("the data promises cover every account table (REQ-030 FR-5, AC-8)", () => {
  const tables = accountTables();

  it("reads the migrations and finds the registers among the account tables", () => {
    expect(tables.length).toBeGreaterThan(30);
    for (const t of ["incidents", "complaints", "worker_clearances"])
      expect(tables).toContain(t);
  });

  it("every account table is exported, packed, a named system table, or awaiting the PO's decision by name", () => {
    const covered = new Set([
      ...EXPORT_TABLES,
      ...PACK_TABLES,
      ...Object.keys(SYSTEM_TABLES),
      ...Object.keys(PENDING_PO_DECISION),
    ]);
    const gaps = tables.filter((t) => !covered.has(t));
    expect(
      gaps,
      "tables in no list; add them to the export or the pack, or name them with a reason",
    ).toEqual([]);
  });

  it("the lists name only tables that exist, so a dropped table leaves them", () => {
    for (const t of [
      ...EXPORT_TABLES,
      ...PACK_TABLES,
      ...Object.keys(SYSTEM_TABLES),
      ...Object.keys(PENDING_PO_DECISION),
    ])
      expect(tables, t).toContain(t);
  });

  it("AC-8: a fixture migration adding public.widgets with an account_id would fail here naming it", () => {
    const fixture = `create table public.widgets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  name text not null
);`;
    const re =
      /create table (?:if not exists )?public\.([a-z_]+)\s*\(([\s\S]*?)\);/gi;
    const found = [...fixture.matchAll(re)]
      .filter((m) => /\baccount_id\b/.test(m[2]))
      .map((m) => m[1]);
    expect(found).toEqual(["widgets"]);
    const covered = new Set([
      ...EXPORT_TABLES,
      ...PACK_TABLES,
      ...Object.keys(SYSTEM_TABLES),
      ...Object.keys(PENDING_PO_DECISION),
    ]);
    expect(found.filter((t) => !covered.has(t))).toEqual(["widgets"]);
  });
});
