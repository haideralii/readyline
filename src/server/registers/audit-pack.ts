import "server-only";
/**
 * The audit pack and the auditor's view (REQ-020 FR-1, FR-2, FR-10):
 * `collectAuditView` gathers every register's rows (the REQ-009 four and
 * the nine audit-day registers), the document control register and the
 * twelve records' live state through the client given (the owner's session,
 * or the admin client scoped to the account an auditor link resolved to);
 * `buildAuditPack` turns that into one zip built on request, nothing
 * stored, with the set's readiness summary and adopted documents read from
 * storage with the admin client, as the exports do, and a one-page cover
 * sheet. Hidden columns (ids, account id, creator) never leave the server.
 */
import { strToU8, zipSync } from "fflate";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AUDIT_DAY_META,
  AUDIT_DAY_SLUGS,
} from "@/lib/registers/audit-day-forms";
import { auditDayAskList } from "@/lib/registers/audit-day-ask";
import {
  auditPackFileName,
  auditorVisibleIncidents,
  newestAdoptedVersions,
  packColumns,
  packLine,
  trailRows,
  type PackLine,
} from "@/lib/registers/audit-pack";
import { renderCoverSheet } from "@/lib/registers/audit-pack-pdf";
import { CSV_COLUMNS, toCsv } from "@/lib/registers/csv";
import { documentTitle } from "@/lib/questionnaire/content";
import {
  WHAT_CHANGED_COLUMNS,
  whatChanged,
  whatChangedFileName,
  whatChangedRows,
  type WhatChangedChange,
} from "@/lib/registers/what-changed";
import { currentPeriod } from "./registration-queries";
import {
  ALL_PERIOD,
  periodFileSuffix,
  periodShownLine,
  type Period,
} from "@/lib/registers/period";
import { packWorkerFiles } from "@/lib/registers/worker-exports";
import { loadWorkerExportSnapshot, part4SectionFor } from "./worker-exports";
import { todaySydney } from "./worker-onboarding";
import { log } from "@/lib/logging/logger";
import { downloadObject, objectPath } from "@/server/generation/storage";
import {
  auditDayOverview,
  listAccountRegisterEvents,
  listAuditDayRows,
} from "./audit-day-queries";
import { documentControlForAccount } from "./document-control-queries";
import { registerFiles } from "./export";
import {
  listComplaints,
  listIncidents,
  listPolicyReviews,
  listWorkerChecks,
  registerOverview,
} from "./queries";

export type AuditTable = {
  id: string;
  title: string;
  columns: readonly string[];
  rows: Record<string, unknown>[];
};

export type AuditView = {
  lines: PackLine[];
  documentControl: Record<string, unknown>[];
  tables: AuditTable[];
  setId: string | null;
  /** REQ-023 FR-5: the period the four registers' rows were filtered by. */
  period: Period;
};

export const DOCUMENT_CONTROL_COLUMNS = [
  "document_type_id",
  "title",
  "version",
  "adopted_on",
  "adopted_by",
  "next_review_on",
  "circulated_on",
  "circulated_workers",
  "state",
] as const;

/**
 * REQ-023 FR-5: with a period, the four REQ-009 registers' rows filter on
 * their date columns (the audit-day registers have no period column yet and
 * show every row); the states come from the whole register (D-2340 B), the
 * row counts and last entries from the rows shown.
 */
export async function collectAuditView(
  supabase: SupabaseClient,
  accountId: string,
  period: Period = ALL_PERIOD,
): Promise<AuditView> {
  const [
    registers,
    auditDay,
    documentControl,
    incidents,
    complaints,
    checks,
    reviews,
  ] = await Promise.all([
    registerOverview(supabase, accountId),
    auditDayOverview(supabase, accountId),
    documentControlForAccount(supabase, accountId),
    listIncidents(supabase, accountId, period),
    listComplaints(supabase, accountId, period),
    listWorkerChecks(supabase, accountId, period),
    listPolicyReviews(supabase, accountId, period),
  ]);
  const tables: AuditTable[] = [
    {
      id: "incidents",
      title: "Incident register",
      columns: CSV_COLUMNS.incidents,
      // Retro finding 30: a draft or rejected report is not in the register.
      rows: auditorVisibleIncidents(incidents) as unknown as Record<
        string,
        unknown
      >[],
    },
    {
      id: "complaints",
      title: "Complaints register",
      columns: CSV_COLUMNS.complaints,
      rows: complaints as unknown as Record<string, unknown>[],
    },
    {
      id: "worker-checks",
      title: "Worker checks register",
      columns: CSV_COLUMNS.worker_clearances,
      rows: checks as unknown as Record<string, unknown>[],
    },
    {
      id: "policy-reviews",
      title: "Policy review register",
      columns: CSV_COLUMNS.policy_reviews,
      rows: reviews as unknown as Record<string, unknown>[],
    },
  ];
  for (const slug of AUDIT_DAY_SLUGS) {
    const rows = await listAuditDayRows(supabase, accountId, slug);
    tables.push({
      id: slug,
      title: AUDIT_DAY_META[slug].title,
      columns: packColumns(rows),
      rows,
    });
  }
  const dcRows = documentControl.rows.map((r) => ({
    document_type_id: r.document_type_id,
    title: r.title,
    version: r.version,
    adopted_on: r.adopted_on,
    adopted_by: r.adopted_by,
    next_review_on: r.next_review_on,
    circulated_on: r.circulated?.on ?? null,
    circulated_workers: r.circulated?.workers ?? null,
    state: r.state,
  }));
  const asks = auditDayAskList({
    registers,
    auditDay,
    documentControl: documentControl.rows,
  });
  const byId = new Map(tables.map((t) => [t.id, t.rows]));
  const lines = asks.map((a) =>
    packLine(
      a.id,
      a.id === "document-control" ? dcRows : (byId.get(a.id) ?? []),
      a.state,
    ),
  );
  return {
    lines,
    documentControl: dcRows,
    tables,
    setId: documentControl.setId,
    period,
  };
}

export type AuditPack = {
  body: Uint8Array;
  fileName: string;
  lines: PackLine[];
  files: string[];
};

/** REQ-023 FR-6: the summary sheet for the pack, or no file when the account has no registration period. */
export async function whatChangedFiles(
  supabase: SupabaseClient,
  accountId: string,
): Promise<Record<string, Uint8Array>> {
  const period = await currentPeriod(supabase, accountId);
  if (!period) return {};
  const [incidents, complaints, checks, reviews, changes] = await Promise.all([
    listIncidents(supabase, accountId),
    listComplaints(supabase, accountId),
    listWorkerChecks(supabase, accountId),
    listPolicyReviews(supabase, accountId),
    // FR-6's last line (Session D, FR-10): the changes register.
    listAuditDayRows(supabase, accountId, "commission-changes"),
  ]);
  const summary = whatChanged({
    changes: changes as unknown as WhatChangedChange[],
    period: period.last_audit_on
      ? { kind: "since-last-audit", from: period.last_audit_on, to: null }
      : { kind: "period", from: period.period_starts_on, to: null },
    periodStartsOn: period.period_starts_on,
    periodEndsOn: period.period_ends_on,
    lastAuditOn: period.last_audit_on,
    today: todaySydney(),
    incidents: auditorVisibleIncidents(incidents),
    complaints,
    checks,
    reviews,
    titleOf: (typeId, title) =>
      typeId === "other" ? title : documentTitle(typeId) || title || typeId,
  });
  return {
    [whatChangedFileName(Boolean(period.last_audit_on))]: strToU8(
      toCsv(WHAT_CHANGED_COLUMNS, whatChangedRows(summary)),
    ),
  };
}

export async function buildAuditPack(input: {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  accountId: string;
  tradingName: string;
  now: Date;
  /** REQ-023 FR-5: the period the four registers' files cover; the whole register by default. */
  period?: Period;
}): Promise<AuditPack> {
  const { supabase, admin, accountId, now } = input;
  const period = input.period ?? ALL_PERIOD;
  const stamp = now.toISOString().slice(0, 10);
  const view = await collectAuditView(supabase, accountId, period);
  const files: Record<string, Uint8Array> = {};

  for (const register of [
    "incidents",
    "complaints",
    "worker_clearances",
    "policy_reviews",
  ] as const)
    Object.assign(
      files,
      // Retro finding 30: the pack's incident file holds the register only
      // (no draft or rejected report), as the auditor's view does.
      await registerFiles(supabase, accountId, register, stamp, {
        registerOnly: true,
        period,
      }),
    );
  for (const t of view.tables)
    if ((AUDIT_DAY_SLUGS as readonly string[]).includes(t.id))
      files[`${t.id}-${stamp}.csv`] = strToU8(toCsv(t.columns, t.rows));
  files[`document-control-${stamp}.csv`] = strToU8(
    toCsv(DOCUMENT_CONTROL_COLUMNS, view.documentControl),
  );
  // REQ-023 FR-6: "what changed since the last audit" as one sheet, the same
  // object the screen renders (AC-4), over the whole registers regardless of
  // the pack's own period; by the last-audit date when one exists, else the
  // registration period; nothing without a period.
  Object.assign(files, await whatChangedFiles(supabase, accountId));
  // FR-1 "including the events trails" (retro finding 25): the audit-day
  // registers share one trail, so it is one file, each line naming its
  // register and its row as the register's own list names it (the row's id
  // never leaves the server).
  const events = await listAccountRegisterEvents(supabase, accountId);
  const titles = new Map<string, string>();
  const labels = new Map<string, Map<string, string>>();
  for (const slug of AUDIT_DAY_SLUGS) {
    const meta = AUDIT_DAY_META[slug];
    titles.set(meta.table, meta.title);
    const byId = new Map<string, string>();
    for (const r of view.tables.find((t) => t.id === slug)?.rows ?? [])
      byId.set(String(r.id), meta.titleOf(r as never));
    labels.set(meta.table, byId);
  }
  // Session C's imports write to the same trail for the REQ-009 registers.
  for (const [table, id, title, label] of [
    ["incidents", "incidents", "Incident register", "reference"],
    ["complaints", "complaints", "Complaints register", "reference"],
    [
      "worker_clearances",
      "worker-checks",
      "Worker checks register",
      "worker_ref",
    ],
  ] as const) {
    titles.set(table, title);
    const byId = new Map<string, string>();
    for (const r of view.tables.find((t) => t.id === id)?.rows ?? [])
      byId.set(String(r.id), String(r[label] ?? ""));
    labels.set(table, byId);
  }
  files[`register-events-${stamp}.csv`] = strToU8(
    toCsv(CSV_COLUMNS.register_events, trailRows(events, labels, titles)),
  );

  // REQ-024 A3 (FR-6, FR-6a; D-2407 as amended): the workers folder, one
  // file per worker and the index, and the two Worker Screening Rules lists
  // unfilled, the same files for the owner and for the auditor link, codes
  // and numbers and never a name (SR-8(a)). REQ-024 Session C (D-2832): the
  // pack's period filters the supervision entries, and the lists speak as at
  // the period's end day when it has one, today otherwise; items, ticks and
  // states stay the whole register's (D-2318 B).
  const today = todaySydney();
  const asAt =
    period.kind !== "all" && period.to !== null && period.to < today
      ? period.to
      : undefined;
  const workers = await loadWorkerExportSnapshot(supabase, accountId, {
    today,
    period,
    asAt,
  });
  for (const [name, csv] of Object.entries(
    packWorkerFiles(workers, stamp, part4SectionFor),
  ))
    files[name] = strToU8(csv);

  if (view.setId) {
    const setId = view.setId;
    try {
      files["readiness-summary.pdf"] = await downloadObject(
        admin,
        objectPath(accountId, setId, "readiness-summary.pdf"),
      );
    } catch (e) {
      log.warn("audit-pack.summary-missing", { accountId, error: e });
    }
    // REQ-024 A0 (D-2436, finding 233): per type, the newest version with
    // `adopted_on` set, from any set, read over the partial index; a latest
    // version the owner has not adopted never ships.
    const adoptedRows = await supabase
      .from("document_versions")
      .select("document_type_id, version, adopted_on, storage_path")
      .eq("account_id", accountId)
      .not("adopted_on", "is", null)
      .limit(2000);
    const documents = newestAdoptedVersions(
      (adoptedRows.data as
        | {
            document_type_id: string;
            version: number;
            adopted_on: string | null;
            storage_path: string;
          }[]
        | null) ?? [],
    );
    for (const d of documents) {
      try {
        files[`documents/${d.document_type_id}.docx`] = await downloadObject(
          admin,
          d.storage_path,
        );
      } catch (e) {
        log.warn("audit-pack.document-missing", {
          accountId,
          documentTypeId: d.document_type_id,
          error: e,
        });
      }
    }
  }

  const names = Object.keys(files).sort();
  files["cover-sheet.pdf"] = await renderCoverSheet({
    tradingName: input.tradingName,
    date: stamp,
    lines: view.lines,
    files: names,
    periodLine: period.kind === "all" ? null : periodShownLine(period),
  });
  return {
    body: zipSync(files, { level: 6 }),
    fileName: auditPackFileName(
      input.tradingName,
      stamp,
      periodFileSuffix(period),
    ),
    lines: view.lines,
    files: ["cover-sheet.pdf", ...names],
  };
}
