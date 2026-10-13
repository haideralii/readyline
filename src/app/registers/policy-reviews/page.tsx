import type { Metadata } from "next";
import { documentTitle } from "@/lib/questionnaire/content";
import {
  listPolicyReviews,
  type PolicyReviewListRow,
} from "@/server/registers/queries";
import { seedPolicyReviews } from "@/server/registers/seed";
import { RegisterList, type ListRow } from "../_components/register-list";
import { RegisterPage, registerContext } from "../_components/shell";

export const metadata: Metadata = { title: "Policy reviews register" };

export function reviewStatusTag(r: PolicyReviewListRow): ListRow["status"] {
  if (r.status === "overdue")
    return {
      key: "overdue",
      label: `Overdue since ${r.next_review_on}`,
      tone: "signal",
    };
  if (r.status === "due-soon")
    return { key: "due-soon", label: `Due ${r.next_review_on}`, tone: "ochre" };
  if (r.status === "not-adopted")
    return { key: "not-adopted", label: "Not adopted yet", tone: "slate" };
  return { key: "current", label: `Next ${r.next_review_on}`, tone: "moss" };
}

export const REVIEW_FILTERS = [
  { key: "overdue", label: "Overdue" },
  { key: "due-soon", label: "Due soon" },
  { key: "not-adopted", label: "Not adopted" },
  { key: "current", label: "Current" },
];

export function reviewTitle(r: PolicyReviewListRow): string {
  return r.document_type_id === "other"
    ? r.title
    : documentTitle(r.document_type_id) || r.title || r.document_type_id;
}

export default async function PolicyReviewsPage() {
  const ctx = await registerContext("/registers/policy-reviews");
  // FR-7: the first visit with a purchased pack and no rows seeds one row per document.
  if (ctx.canWrite)
    await seedPolicyReviews(ctx.supabase, ctx.viewer.account.id);
  const rows = await listPolicyReviews(ctx.supabase, ctx.viewer.account.id);
  return (
    <RegisterPage
      title="Policy reviews"
      intro="When each policy was adopted and when it is next due. Ticking Done on the checklist sets the adopted date; the review date follows the cycle."
      canWrite={ctx.canWrite}
      addHref="/registers/policy-reviews/new"
      addLabel="Add a policy"
      exportHref="/registers/policy-reviews/export.csv"
      back={{ href: "/registers", label: "Registers" }}
    >
      <RegisterList
        testId="policy-reviews-list"
        rows={rows.map((r) => ({
          id: r.id,
          href: `/registers/policy-reviews/${r.id}`,
          title: reviewTitle(r),
          detail: r.adopted_on
            ? `Adopted ${r.adopted_on}; every ${r.review_cycle_months} months.`
            : `Not adopted yet; every ${r.review_cycle_months} months once adopted.`,
          status: reviewStatusTag(r),
        }))}
        filters={REVIEW_FILTERS}
        empty="No policies listed yet. Buy the document pack and they appear here, or add one by hand."
      />
    </RegisterPage>
  );
}
