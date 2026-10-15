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
  packColumns,
  packLine,
  type PackLine,
} from "@/lib/registers/audit-pack";
import { renderCoverSheet } from "@/lib/registers/audit-pack-pdf";
import { CSV_COLUMNS, toCsv } from "@/lib/registers/csv";
import { log } from "@/lib/logging/logger";
import { listAdoptedTypeIds } from "@/server/path/state";
import { listLatestDocuments } from "@/server/generation/queries";
import { downloadObject, objectPath } from "@/server/generation/storage";
import { auditDayOverview, listAuditDayRows } from "./audit-day-queries";
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

export async function collectAuditView(
  supabase: SupabaseClient,
  accountId: string,
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
    listIncidents(supabase, accountId),
    listComplaints(supabase, accountId),
    listWorkerChecks(supabase, accountId),
    listPolicyReviews(supabase, accountId),
  ]);
  const tables: AuditTable[] = [
    {
      id: "incidents",
      title: "Incident register",
      columns: CSV_COLUMNS.incidents,
      rows: incidents as unknown as Record<string, unknown>[],
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
  };
}

export type AuditPack = {
  body: Uint8Array;
  fileName: string;
  lines: PackLine[];
  files: string[];
};

export async function buildAuditPack(input: {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  accountId: string;
  tradingName: string;
  now: Date;
}): Promise<AuditPack> {
  const { supabase, admin, accountId, now } = input;
  const stamp = now.toISOString().slice(0, 10);
  const view = await collectAuditView(supabase, accountId);
  const files: Record<string, Uint8Array> = {};

  for (const register of [
    "incidents",
    "complaints",
    "worker_clearances",
    "policy_reviews",
  ] as const)
    Object.assign(
      files,
      await registerFiles(supabase, accountId, register, stamp),
    );
  for (const t of view.tables)
    if ((AUDIT_DAY_SLUGS as readonly string[]).includes(t.id))
      files[`${t.id}-${stamp}.csv`] = strToU8(toCsv(t.columns, t.rows));
  files[`document-control-${stamp}.csv`] = strToU8(
    toCsv(DOCUMENT_CONTROL_COLUMNS, view.documentControl),
  );

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
    const [documents, adopted] = await Promise.all([
      listLatestDocuments(supabase, setId),
      listAdoptedTypeIds(supabase, accountId),
    ]);
    for (const d of documents) {
      if (!adopted.has(d.document_type_id)) continue;
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
  });
  return {
    body: zipSync(files, { level: 6 }),
    fileName: auditPackFileName(input.tradingName, stamp),
    lines: view.lines,
    files: ["cover-sheet.pdf", ...names],
  };
}
