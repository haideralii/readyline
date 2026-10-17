/**
 * REQ-024 Session A3, the export screen (FR-6b): the worker files and the
 * two Worker Screening Rules lists as direct downloads, with the one-time
 * fill (D-2408, D-2409). Reached from the staff matrix; open to the owner
 * whatever the subscription's state (D-2422), since the s 21 record must
 * not sit behind a lapsed payment.
 */
import type { Metadata } from "next";
import { EXPORT_SCREEN_PATH } from "@/lib/registers/fill";
import { ownerNameFact } from "@/server/registers/fill-page";
import { FillFormClient } from "../../_components/fill-form-client";
import { EMPTY_FILL_VALUES } from "../../_components/fill-form";
import { RegisterPage, registerContext } from "../../_components/shell";

export const metadata: Metadata = {
  title: "Worker files and the two Rules lists",
};
export const dynamic = "force-dynamic";

export default async function Page() {
  const ctx = await registerContext(EXPORT_SCREEN_PATH);
  const accountId = ctx.viewer.account.id;
  const [rows, exceptions, assessorDefault] = await Promise.all([
    ctx.supabase
      .from("staff_matrix")
      .select("worker_ref, ended_on")
      .eq("account_id", accountId)
      .order("worker_ref", { ascending: true }),
    ctx.supabase
      .from("screening_exceptions")
      .select("supervisor_ref")
      .eq("account_id", accountId)
      .not("supervisor_ref", "is", null),
    ownerNameFact(ctx.supabase, accountId),
  ]);
  const all =
    (rows.data as { worker_ref: string; ended_on: string | null }[] | null) ??
    [];
  const supervisorRefs = [
    ...new Set(
      ((exceptions.data as { supervisor_ref: string }[] | null) ?? []).map(
        (e) => e.supervisor_ref,
      ),
    ),
  ];
  return (
    <RegisterPage
      title="Worker files and the two Rules lists"
      intro="One file per worker with every item, its state, the check and application numbers and the trail; the s 18 screening list and the s 17 roles list as drafts of what the Worker Screening Rules ask you to keep. Each is built when you press its button and sent to you once. Your audit pack carries the same files with codes and numbers only."
      canWrite={ctx.canWrite}
      back={{ href: "/registers/staff-matrix", label: "Staff matrix" }}
    >
      <FillFormClient
        codes={all.filter((r) => !r.ended_on).map((r) => r.worker_ref)}
        pastCodes={all.filter((r) => r.ended_on).map((r) => r.worker_ref)}
        supervisorRefs={supervisorRefs}
        assessorDefault={assessorDefault}
        state={EMPTY_FILL_VALUES}
      />
    </RegisterPage>
  );
}
