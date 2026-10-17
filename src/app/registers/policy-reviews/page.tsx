import type { Metadata } from "next";
import { formatDateAu } from "@/lib/generator/fixed-text";
import { documentTitle } from "@/lib/questionnaire/content";
import {
  listPolicyReviews,
  type PolicyReviewListRow,
} from "@/server/registers/queries";
import { seedPolicyReviews } from "@/server/registers/seed";
import {
  POLICY_REVIEW_COLUMNS,
  cellsFor,
  tableColumns,
} from "@/lib/registers/table-columns";
import { periodQuery } from "@/lib/registers/period";
import {
  PeriodEmpty,
  RegisterPeriodBar,
  pagePeriod,
} from "../_components/period-filter";
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

export default async function PolicyReviewsPage({
  searchParams,
}: PageProps<"/registers/policy-reviews">) {
  const ctx = await registerContext("/registers/policy-reviews");
  // FR-7: the first visit with a purchased pack and no rows seeds one row per document.
  if (ctx.canWrite)
    await seedPolicyReviews(ctx.supabase, ctx.viewer.account.id);
  // REQ-023 FR-5: the period from the URL on the latest review date, "All" by default; a policy not yet reviewed stays (D-2318 A).
  const filter = await pagePeriod(
    ctx.supabase,
    ctx.viewer.account.id,
    searchParams,
  );
  const rows = await listPolicyReviews(
    ctx.supabase,
    ctx.viewer.account.id,
    filter.period,
  );
  const filtered = filter.period.kind !== "all";
  return (
    <RegisterPage
      title="Policy reviews"
      intro="When each policy was adopted and when it is next due. Adopting a document on the adopt step or its own page sets the date; the review date follows the cycle."
      canWrite={ctx.canWrite}
      addHref="/registers/policy-reviews/new"
      addLabel="Add a policy"
      exportHref={`/registers/policy-reviews/export.csv${periodQuery(filter.period)}`}
      exportLabel="Download as a spreadsheet (CSV)"
      count={filtered ? undefined : rows.length}
      back={{ href: "/registers", label: "Registers" }}
    >
      <RegisterPeriodBar
        basePath="/registers/policy-reviews"
        register="policy_reviews"
        rows={rows}
        state={filter}
      />
      {filtered && rows.length === 0 ? (
        <PeriodEmpty
          basePath="/registers/policy-reviews"
          testId="policy-reviews-list"
        />
      ) : (
        <RegisterList
          testId="policy-reviews-list"
          rows={rows.map((r) => ({
            id: r.id,
            href: `/registers/policy-reviews/${r.id}`,
            title: reviewTitle(r),
            // QA pass F5: the day in the product's words ("16 October 2026"), as the adopt step and the legal pages print it.
            detail: r.adopted_on
              ? `Adopted ${formatDateAu(r.adopted_on)}; every ${r.review_cycle_months} months.`
              : `Not adopted yet; every ${r.review_cycle_months} months once adopted.`,
            status: reviewStatusTag(r),
            cells: cellsFor(POLICY_REVIEW_COLUMNS, r),
          }))}
          filters={REVIEW_FILTERS}
          columns={tableColumns(POLICY_REVIEW_COLUMNS)}
          emptyAction={
            ctx.canWrite
              ? { href: "/registers/policy-reviews/new", label: "Add a policy" }
              : undefined
          }
          empty="No policies listed yet. Buy the document pack and they appear here, or add one by hand."
        />
      )}
    </RegisterPage>
  );
}
