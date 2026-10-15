import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/server/accounts/queries";
import { ComplaintFormView } from "@/app/registers/_components/complaint-form";

export const metadata: Metadata = {
  title: "Log a complaint",
  robots: { index: false, follow: false },
};

/** REQ-020 FR-4: the same complaint form, saved as the worker's own row. */
export default async function WorkerNewComplaintPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=%2Fworker%2Fcomplaints%2Fnew");
  if (viewer.deleted) redirect("/account/deleted");
  if (viewer.account) redirect("/registers/complaints/new");
  if (!viewer.worker) redirect("/account/setup");
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-sm">
        <Link href="/worker" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
          Your entries
        </Link>
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Log a complaint</h1>
      <ComplaintFormView afterSave="/worker?saved=1" />
    </div>
  );
}
