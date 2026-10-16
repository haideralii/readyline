import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GENERAL_INFORMATION_STATEMENT } from "@/lib/brand";
import {
  AUDITOR_TOKEN_PATTERN,
  hashAuditorToken,
} from "@/lib/registers/auditor-link";
import { EMERGENCY_LINE } from "@/lib/registers/worker";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { SupabaseEnvError } from "@/server/supabase/env";
import { ReportForm } from "./report-form";

export const metadata: Metadata = {
  title: "Report an incident",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * The signed-out report form behind an account's report link (REQ-020
 * FR-5, SR-1, SR-3): the incident form's fields minus the Commission
 * notification fields, the participant-data warning, "who are you" as a
 * code or a role, the 000 line and the general-information line above. A
 * revoked or unknown token is a plain 404. The worker codes offered are the
 * account's own (the clearance register), read with the service key by
 * code only.
 */
export default async function ReportPage({
  params,
}: PageProps<"/report/[token]">) {
  const { token } = await params;
  if (!AUDITOR_TOKEN_PATTERN.test(token)) notFound();
  let name: string | null = null;
  let codes: string[] = [];
  try {
    const admin = createSupabaseAdminClient();
    const r = await admin.rpc("report_link_lookup", {
      p_token_hash: hashAuditorToken(token),
    });
    const row = (
      r.data as { account_id: string; trading_name: string }[] | null
    )?.[0];
    if (row) {
      name = row.trading_name;
      const w = await admin
        .from("worker_clearances")
        .select("worker_ref")
        .eq("account_id", row.account_id)
        .limit(200);
      codes = [
        ...new Set(
          ((w.data as { worker_ref: string }[] | null) ?? []).map(
            (x) => x.worker_ref,
          ),
        ),
      ].sort();
    }
  } catch (e) {
    if (e instanceof SupabaseEnvError) notFound();
    throw e;
  }
  if (!name) notFound();
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-semibold tracking-tight">
        Report an incident to {name}
      </h1>
      <p
        className="mt-3 text-lg leading-7 font-medium"
        data-testid="emergency-line"
      >
        {EMERGENCY_LINE}
      </p>
      <p className="text-slate mt-2 text-sm leading-6">
        {GENERAL_INFORMATION_STATEMENT}
      </p>
      <p className="mt-4 leading-7">
        What you write here goes to the owner as a report they confirm. Use
        codes for people, never names.
      </p>
      <ReportForm token={token} workerCodes={codes} />
    </div>
  );
}
