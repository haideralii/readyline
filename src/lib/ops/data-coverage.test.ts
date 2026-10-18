import { describe, expect, it } from "vitest";
import { WORKER_EXPORT_TABLES } from "@/server/accounts/export";
import { accountTables, accountTablesInSql } from "./account-tables";

/**
 * REQ-030 FR-5, AC-8 (D-2869): every table whose migration gives it an
 * `account_id` column is either in the account export, in the audit pack,
 * or named below with one line saying why it is the system's and not the
 * provider's record. A migration that adds a table none of the lists carries
 * fails here naming it, so a new record cannot slip past the data promises
 * (the privacy page's export and deletion sentences).
 */

/** Tables the account export writes (`src/server/accounts/export.ts`): the account's own rows, the worker tables and the six the PO moved here (D-2898). */
// The account row itself (`accounts`) has no account_id column; the export writes it as the first file.
const EXPORT_TABLES: readonly string[] = [
  "audit_log",
  "checklist_items",
  "memberships",
  "questionnaire_drafts",
  "registration_periods",
  ...WORKER_EXPORT_TABLES,
  // D-2898 (18 Oct 2026): in account.json under their own keys.
  "account_facts",
  "document_change_reviews",
  "policy_circulations",
  "purchases",
  "subscriptions",
  "entitlements",
  // REQ-033 FR-3 (D-2932, D-2300): the audit findings, under their own key; the pack carries them too.
  "findings",
];

/** Tables the audit pack writes (`src/server/registers/audit-pack.ts` through the register files and the audit-day meta). */
const PACK_TABLES: readonly string[] = [
  "incidents",
  "complaints",
  "worker_clearances",
  "policy_reviews",
  "document_versions",
  "register_events",
  // D-2898: the older per-register trails, in the pack as
  // `incidents-events-<date>.csv` and `complaints-events-<date>.csv`
  // (`src/server/registers/export.ts`, `registerFiles`).
  "incident_events",
  "complaint_events",
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
  // D-2898 (PO, 18 Oct 2026): the six below, each with the line from the
  // Dev's report of the same day.
  auditor_links:
    "Auditor links: a token hash, the hours and the opens; the hash is useless to the provider and the opens are audit_log lines, exported.",
  report_links:
    "Incident report links: a token hash and the dates; the hash is useless to the provider.",
  invitations:
    "Worker invitations: a hashed token, the worker code and the dates; the hash is useless and the membership that results is exported.",
  reminder_settings:
    "One row per account: do_not_send and the hashed unsubscribe token; the preference is on the account page and the hash is useless.",
  generation_jobs:
    "The paid generation job queue; a queue, not a record; the sets are the documents, in the pack.",
  version_sets:
    "The generated set's metadata (status, counts, storage prefix); the documents themselves are in the pack.",
};

/**
 * Tables found in no list and waiting for the PO's decision per table
 * (D-2869: the Dev reports them with a recommendation each, the PO decides).
 * The first run (18 Oct 2026) listed fourteen; D-2898 moved every one into
 * the export, the pack or SYSTEM_TABLES the same day, so this is empty. A
 * table named here passes the test while the decision is pending; it leaves
 * when it joins a list.
 */
const PENDING_PO_DECISION: Record<string, string> = {};

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
    const found = accountTablesInSql(fixture);
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
