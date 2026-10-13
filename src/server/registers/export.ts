import "server-only";
/**
 * The register exports (REQ-009 FR-6, SR-3): CSV with a byte-order mark,
 * dates as stored, and for incidents and complaints a zip holding the
 * register and its events as two files. Member-only through RLS, five an
 * hour per account, audit-logged with ids only.
 */
import { strToU8, zipSync } from "fflate";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CSV_COLUMNS, toCsv } from "@/lib/registers/csv";
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

export async function buildRegisterExport(
  supabase: SupabaseClient,
  accountId: string,
  register: ExportRegister,
  now: Date,
): Promise<{ body: Uint8Array; contentType: string; fileName: string }> {
  const stamp = now.toISOString().slice(0, 10);
  if (register === "incidents" || register === "complaints") {
    const rows =
      register === "incidents"
        ? await listIncidents(supabase, accountId)
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
    const events = ((ev.data as Record<string, unknown>[] | null) ?? []).map(
      (e) => ({
        reference: byId.get(e[fk] as string) ?? "",
        at: e.at,
        kind: e.kind,
        note: e.note,
      }),
    );
    const files: Record<string, Uint8Array> = {
      [`${register}-${stamp}.csv`]: strToU8(toCsv(CSV_COLUMNS[register], rows)),
      [`${register}-events-${stamp}.csv`]: strToU8(
        toCsv(CSV_COLUMNS[eventsTable], events),
      ),
    };
    return {
      body: zipSync(files, { level: 6 }),
      contentType: "application/zip",
      fileName: `readyline-${register}-${stamp}.zip`,
    };
  }
  const rows =
    register === "worker_clearances"
      ? await listWorkerChecks(supabase, accountId)
      : await listPolicyReviews(supabase, accountId);
  const name =
    register === "worker_clearances" ? "worker-checks" : "policy-reviews";
  return {
    body: strToU8(toCsv(CSV_COLUMNS[register], rows)),
    contentType: "text/csv; charset=utf-8",
    fileName: `readyline-${name}-${stamp}.csv`,
  };
}
