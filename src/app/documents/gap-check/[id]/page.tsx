import { PageShell } from "@/components/page-shell";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { gapOutlineFor } from "@/lib/gap-check/outline";
import {
  GAP_CHECK_INTRO,
  GAP_STATE_LABELS,
  gapCountsLine,
  inPackLine,
  keptAsRecordLine,
} from "@/lib/gap-check/words";
import { getViewer } from "@/server/accounts/queries";
import {
  gapCheckDay,
  getGapCheck,
  listGapCheckSections,
} from "@/server/gap-check/queries";
import {
  listLatestDocuments,
  listVersionSets,
} from "@/server/generation/queries";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { MarkGapCheckOpened } from "./mark-opened";

export const metadata: Metadata = { title: "Gap check result" };

/**
 * REQ-035 FR-4 (D-2964, D-2966): one check's result. The counts line, then
 * every outline section in order with its state, the reason, the indicator
 * labels, the pack's document and section for a partly or missing one
 * (linked into the account's newest set when it holds that document, else
 * to the catalogue entry on the documents page), and the register a records
 * section keeps. Nothing of the provider's document but the title they typed.
 */
export default async function GapCheckResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer)
    redirect(
      `/sign-in?next=${encodeURIComponent(`/documents/gap-check/${id}`)}`,
    );
  if (viewer.deleted) redirect("/account/deleted");
  if (!viewer.account) redirect(viewer.worker ? "/worker" : "/account/setup");
  const supabase = await createSupabaseServerClient();
  const check = await getGapCheck(supabase, id);
  if (!check || check.account_id !== viewer.account.id) notFound();
  const [sections, sets] = await Promise.all([
    listGapCheckSections(supabase, id),
    listVersionSets(supabase, viewer.account.id),
  ]);
  const outline = gapOutlineFor(check.document_type_id);
  const typeTitle = outline?.title ?? check.document_type_id;
  const newest = sets[0]?.id ?? null;
  const held = newest
    ? (await listLatestDocuments(supabase, newest)).some(
        (d) => d.document_type_id === check.document_type_id,
      )
    : false;
  const packHref =
    newest && held
      ? `/documents/${newest}/${check.document_type_id}`
      : `/documents#${check.document_type_id}`;
  const registersOf = new Map(
    (outline?.sections ?? []).map((s) => [s.id, s.registers]),
  );
  return (
    <PageShell kind="reading">
      {check.created_by !== viewer.user.id ? (
        <MarkGapCheckOpened id={id} />
      ) : null}
      <p className="text-sm">
        <Link
          href="/documents/gap-check"
          className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
        >
          ‹ Check a policy you already have
        </Link>
      </p>
      <h1 className="mt-2" data-testid="gap-check-counts">
        {gapCountsLine(check.title, typeTitle, check)}
      </h1>
      <p className="text-slate mt-2 text-sm" data-testid="gap-check-day">
        Run on {gapCheckDay(check.created_at)}.
      </p>
      <p className="text-ink mt-3 text-sm leading-6">{GAP_CHECK_INTRO}</p>
      <ol
        className="divide-rule mt-6 divide-y"
        data-testid="gap-check-sections"
      >
        {sections.map((s) => (
          <li
            key={s.id}
            className="py-4"
            data-testid="gap-check-section"
            data-section={s.section_id}
            data-state={s.state}
          >
            <h2 className="text-lg font-medium">
              {s.number ? `${s.number} ` : ""}
              {s.heading}
            </h2>
            <p
              className="mt-1 text-sm font-medium"
              data-testid="gap-check-state"
            >
              {GAP_STATE_LABELS[s.state]}
            </p>
            <p
              className="text-ink mt-1 leading-7"
              data-testid="gap-check-reason"
            >
              {s.reason}
            </p>
            {s.indicator_labels.length > 0 ? (
              <p
                className="text-slate mt-1 text-sm leading-6"
                data-testid="gap-check-indicators"
              >
                {s.indicator_labels.join("; ")}
              </p>
            ) : null}
            {s.state !== "covered" ? (
              <p className="mt-2 text-sm">
                <Link
                  href={packHref}
                  className="underline underline-offset-4"
                  data-testid="gap-check-pack-link"
                >
                  {inPackLine(typeTitle, s.number || "", s.heading)}
                </Link>
              </p>
            ) : null}
            {(registersOf.get(s.section_id) ?? []).map((r) => (
              <p key={r} className="mt-2 text-sm">
                <Link
                  href="/registers"
                  className="underline underline-offset-4"
                  data-testid="gap-check-record"
                >
                  {keptAsRecordLine(r)}
                </Link>
              </p>
            ))}
          </li>
        ))}
      </ol>
    </PageShell>
  );
}
