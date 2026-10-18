import { PageShell } from "@/components/page-shell";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { gapCheckTypes } from "@/lib/gap-check/outline";
import {
  GAP_CHECK_INTRO,
  GAP_CHECK_TITLE,
  gapCountsLine,
} from "@/lib/gap-check/words";
import { documentTypeById } from "@/lib/generator/catalogue";
import { ANSWERS_VERSION, answersSchemaFor } from "@/lib/questionnaire/schema";
import { buildResult } from "@/lib/questionnaire/result";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { loadServerDraft } from "@/server/accounts/actions";
import { getViewer } from "@/server/accounts/queries";
import { gapCheckDay, listGapChecks } from "@/server/gap-check/queries";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { GapCheckForm } from "./gap-check-form";

export const metadata: Metadata = {
  title: GAP_CHECK_TITLE,
  description:
    "Compare a policy you already have with the outline Readyline writes from the quality indicators, section by section.",
};

/** The document type ids the account's result calls for, or null without a result. */
async function resultTypeIds(): Promise<Set<string> | null> {
  const draft = await loadServerDraft();
  if (!draft) return null;
  const dataset = getStandardsDataset();
  const schema = answersSchemaFor(
    new Set(dataset.registrationGroups.map((g) => g.code)),
  );
  const parsed = schema.safeParse({
    ...(draft.answers as Record<string, unknown>),
    answersVersion: ANSWERS_VERSION,
  });
  if (!parsed.success) return null;
  const built = buildResult(dataset, parsed.data);
  if (!built.ok) return null;
  return new Set(built.result.documents.map((d) => d.id));
}

/**
 * REQ-035 FR-1, FR-5 (D-2962, D-2966): the owner's page to check a policy
 * they already have against Readyline's outline, and the list of checks run
 * so far, each opening its result.
 */
export default async function GapCheckPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=%2Fdocuments%2Fgap-check");
  if (viewer.deleted) redirect("/account/deleted");
  if (!viewer.account) redirect(viewer.worker ? "/worker" : "/account/setup");
  const supabase = await createSupabaseServerClient();
  const [ids, checks] = await Promise.all([
    resultTypeIds(),
    listGapChecks(supabase, viewer.account.id),
  ]);
  const types = gapCheckTypes();
  const inAudit = ids ? types.filter((t) => ids.has(t.id)) : types;
  const notInAudit = ids ? types.filter((t) => !ids.has(t.id)) : [];
  return (
    <PageShell kind="reading">
      <p className="text-sm">
        <Link
          href="/documents"
          className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
        >
          ‹ Your documents
        </Link>
      </p>
      <h1 className="mt-2">{GAP_CHECK_TITLE}</h1>
      <p className="text-ink mt-3 leading-7" data-testid="gap-check-intro">
        {GAP_CHECK_INTRO}
      </p>
      <GapCheckForm inAudit={inAudit} notInAudit={notInAudit} />
      <section
        className="mt-10"
        aria-labelledby="gap-check-list-heading"
        data-testid="gap-check-list"
      >
        <h2 id="gap-check-list-heading" className="text-lg font-medium">
          Your checks
        </h2>
        {checks.length === 0 ? (
          <p
            className="text-slate mt-2 text-sm"
            data-testid="gap-check-list-empty"
          >
            No checks yet.
          </p>
        ) : (
          <ul className="divide-rule mt-2 divide-y">
            {checks.map((c) => (
              <li key={c.id} className="py-3" data-testid="gap-check-list-item">
                <Link
                  href={`/documents/gap-check/${c.id}`}
                  className="underline underline-offset-4"
                >
                  {gapCountsLine(
                    c.title,
                    documentTypeById(c.document_type_id)?.title ??
                      c.document_type_id,
                    c,
                  )}
                </Link>
                <span className="text-slate block text-sm">
                  {gapCheckDay(c.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
