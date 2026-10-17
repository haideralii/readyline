import "server-only";
/**
 * The register exports (REQ-009 FR-6, SR-3): CSV with a byte-order mark,
 * dates as stored, and for incidents and complaints a zip holding the
 * register and its events as two files. Member-only through RLS, five an
 * hour per account, audit-logged with ids only.
 */
import { strToU8, zipSync } from "fflate";
import type { SupabaseClient } from "@supabase/supabase-js";
import { auditorVisibleIncidents } from "@/lib/registers/audit-pack";
import { CSV_COLUMNS, CSV_HEADER_LABELS, toCsv } from "@/lib/registers/csv";
import {
  listComplaints,
  listIncidents,
  listPolicyReviews,
  listWorkerChecks,
} from "./queries";

export type ExportRegister =
  "incidents" | "complaints" | "worker_clearances" | "policy_reviews";

export const EXPORT_PATHS: Record<string, ExportRegister> = {
  incidents: "incidents",
  complaints: "complaints",
  "worker-checks": "worker_clearances",
  "policy-reviews": "policy_reviews",
};

/**
 * A register's export as files by name (one CSV, or the register and its
 * event trail for incidents and complaints). The single export and the
 * audit pack (REQ-020 FR-1) both build from this, so the pack carries
 * exactly what the export does, except that the pack asks for the register
 * only (`registerOnly`): a draft or rejected report and its trail stay out
 * of what an auditor sees (FR-5; retro review finding 30), while the owner's
 * own export keeps them.
 */
export async function registerFiles(
  supabase: SupabaseClient,
  accountId: string,
  register: ExportRegister,
  stamp: string,
  options: { registerOnly?: boolean } = {},
): Promise<Record<string, Uint8Array>> {
  if (register === "incidents" || register === "complaints") {
    const rows =
      register === "incidents"
        ? await listIncidents(supabase, accountId).then((all) =>
            options.registerOnly ? auditorVisibleIncidents(all) : all,
          )
        : await listComplaints(supabase, accountId);
    const eventsTable =
      register === "incidents" ? "incident_events" : "complaint_events";
    const fk = register === "incidents" ? "incident_id" : "complaint_id";
    const ev = await supabase
      .from(eventsTable)
      .select("*")
      .eq("account_id", accountId)
      .order("at", { ascending: true })
      .limit(5000);
    const byId = new Map(rows.map((r) => [r.id, r.reference]));
    const events = ((ev.data as Record<string, unknown>[] | null) ?? [])
      .filter((e) => !options.registerOnly || byId.has(e[fk] as string))
      .map((e) => ({
        reference: byId.get(e[fk] as string) ?? "",
        at: e.at,
        kind: e.kind,
        note: e.note,
      }));
    return {
      [`${register}-${stamp}.csv`]: strToU8(toCsv(CSV_COLUMNS[register], rows)),
      [`${register}-events-${stamp}.csv`]: strToU8(
        toCsv(CSV_COLUMNS[eventsTable], events),
      ),
    };
  }
  const rows =
    register === "worker_clearances"
      ? await listWorkerChecks(supabase, accountId)
      : await listPolicyReviews(supabase, accountId);
  const name =
    register === "worker_clearances" ? "worker-checks" : "policy-reviews";
  return {
    [`${name}-${stamp}.csv`]: strToU8(
      toCsv(CSV_COLUMNS[register], rows, CSV_HEADER_LABELS[register]),
    ),
  };
}

export async function buildRegisterExport(
  supabase: SupabaseClient,
  accountId: string,
  register: ExportRegister,
  now: Date,
): Promise<{ body: Uint8Array; contentType: string; fileName: string }> {
  const stamp = now.toISOString().slice(0, 10);
  const files = await registerFiles(supabase, accountId, register, stamp);
  if (register === "incidents" || register === "complaints") {
    return {
      body: zipSync(files, { level: 6 }),
      contentType: "application/zip",
      fileName: `readyline-${register}-${stamp}.zip`,
    };
  }
  const name =
    register === "worker_clearances" ? "worker-checks" : "policy-reviews";
  return {
    body: Object.values(files)[0],
    contentType: "text/csv; charset=utf-8",
    fileName: `readyline-${name}-${stamp}.csv`,
  };
}
