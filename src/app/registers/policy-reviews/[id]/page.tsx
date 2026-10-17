import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatDateAu } from "@/lib/generator/fixed-text";
import { fromPolicyReviewRow } from "@/lib/registers/labels";
import { sydneyDay } from "@/lib/metrics/counters";
import { listAdoptedDates } from "@/server/path/state";
import { getPolicyReview } from "@/server/registers/queries";
import { documentOptions } from "../catalogue";
import { PolicyReviewFormView } from "../../_components/policy-review-form";
import { StatusTag } from "../../_components/register-list";
import { RegisterPage, registerContext } from "../../_components/shell";
import { reviewStatusTag, reviewTitle } from "../page";

export const metadata: Metadata = { title: "Policy review" };

export default async function PolicyReviewPage({
  params,
}: PageProps<"/registers/policy-reviews/[id]">) {
  const { id } = await params;
  const ctx = await registerContext(`/registers/policy-reviews/${id}`);
  const row = await getPolicyReview(ctx.supabase, ctx.viewer.account.id, id);
  if (!row) notFound();
  // REQ-024 A0 (D-2435): a catalogue type's adopted date is shown from the
  // pack's version column, never typed here.
  const adoptedDates = ctx.canWrite
    ? Object.fromEntries(
        await listAdoptedDates(ctx.supabase, ctx.viewer.account.id),
      )
    : {};
  return (
    <RegisterPage
      title={reviewTitle(row)}
      canWrite={ctx.canWrite}
      back={{ href: "/registers/policy-reviews", label: "Policy reviews" }}
    >
      <p className="mt-3">
        <StatusTag status={reviewStatusTag(row)} />
      </p>
      {ctx.canWrite ? (
        <PolicyReviewFormView
          id={id}
          initial={fromPolicyReviewRow(row)}
          documentOptions={documentOptions()}
          adoptedDates={adoptedDates}
          today={sydneyDay()}
        />
      ) : (
        <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {(
            [
              [
                "Adopted",
                row.adopted_on ? formatDateAu(row.adopted_on) : "Not yet",
              ],
              ["Months between reviews", String(row.review_cycle_months)],
              ["Last reviewed", row.last_reviewed_on ?? "Not yet"],
              ["Next review", row.next_review_on ?? "After adoption"],
              ["Reviewer", row.reviewer_ref ?? "Not set"],
              ["Note", row.note || "None"],
            ] as [string, string][]
          ).map(([k, v]) => (
            <div key={k}>
              <dt className="text-zinc-600 dark:text-zinc-400">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </RegisterPage>
  );
}
