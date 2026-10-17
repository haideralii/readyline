import { PageShell } from "@/components/page-shell";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GENERAL_INFORMATION_STATEMENT } from "@/lib/brand";
import {
  checklistPeriod,
  deriveChecklist,
  progressLine,
} from "@/lib/checklist/derive";
import {
  DRAFTED_LABEL,
  mergeChecklist,
  statusLabel,
} from "@/lib/checklist/state";
import { applyWorkerStates } from "@/lib/checklist/worker-states";
import { ANSWERS_VERSION, answersSchemaFor } from "@/lib/questionnaire/schema";
import { buildResult } from "@/lib/questionnaire/result";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { loadServerDraft } from "@/server/accounts/actions";
import { getViewer } from "@/server/accounts/queries";
import { latestReadySet, listChecklistItems } from "@/server/checklist/queries";
import { currentPeriod } from "@/server/registers/registration-queries";
import {
  accountWorkerStates,
  todaySydney,
} from "@/server/registers/worker-onboarding";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { ChecklistView } from "./checklist-view";

export const metadata: Metadata = { title: "Readiness checklist" };

/**
 * The readiness checklist (REQ-006 FR-3, FR-4): derived from the saved
 * questionnaire at request time, merged with the statuses and notes the
 * provider stored. The print rendering lists everything regardless of which
 * groups are open on screen.
 */
export default async function ChecklistPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=%2Fchecklist");
  if (viewer.deleted) redirect("/account/deleted");
  if (!viewer.account) redirect("/account/setup");

  const draft = await loadServerDraft();
  const dataset = getStandardsDataset();
  const schema = answersSchemaFor(
    new Set(dataset.registrationGroups.map((g) => g.code)),
  );
  const answers = draft
    ? schema.safeParse({ answersVersion: ANSWERS_VERSION, ...draft.answers })
    : null;
  const built = answers?.success ? buildResult(dataset, answers.data) : null;
  if (!answers?.success || !built?.ok) {
    return (
      <PageShell kind="grid">
        <h1 className="">Readiness checklist</h1>
        <p className="mt-3 leading-7" data-testid="checklist-needs-answers">
          Your checklist is built from your questionnaire answers.{" "}
          <Link href="/start" className="underline underline-offset-2">
            Finish the questionnaire
          </Link>{" "}
          to see it.
        </p>
      </PageShell>
    );
  }

  const supabase = await createSupabaseServerClient();
  const [stored, latest, period, workers] = await Promise.all([
    listChecklistItems(supabase, viewer.account.id),
    latestReadySet(supabase, viewer.account.id),
    currentPeriod(supabase, viewer.account.id),
    // REQ-024 Session C (FR-10; D-2831): the two people items read the staff list while it has rows.
    accountWorkerStates(
      supabase,
      viewer.account.id,
      viewer.user.id,
      built.result,
      todaySydney(),
    ),
  ]);
  // REQ-023 FR-4: the dated audit items once a registration period exists.
  const checklist = deriveChecklist(
    built.result,
    answers.data,
    dataset,
    checklistPeriod(period),
  );
  const shown = applyWorkerStates(
    mergeChecklist({
      checklist,
      stored,
      draftedDocumentTypeIds: latest.documentTypeIds,
    }),
    workers,
    todaySydney(),
  );
  const today = new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Australia/Sydney",
  }).format(new Date());

  return (
    <PageShell kind="grid">
      <ChecklistView
        tradingName={viewer.account.trading_name}
        pathway={built.result.pathway}
        shown={shown}
        setId={latest.setId}
      />

      {/* FR-4: the print rendering, every item with status and note. */}
      <section
        aria-hidden="true"
        className="hidden print:block"
        data-testid="checklist-print"
      >
        <h1 className="">Readiness checklist: {viewer.account.trading_name}</h1>
        <p className="mt-1 text-sm">
          Printed {today}. {progressLine(shown.ready, shown.total)}.
        </p>
        {shown.groups.map((g) => (
          <div key={g.id} className="mt-4">
            <h2 className="">
              {g.title} ({g.ready} of {g.items.length} ready)
            </h2>
            <ul className="mt-1 list-disc pl-5 text-sm leading-6">
              {g.items.map((i) => (
                <li key={i.id}>
                  {i.title}:{" "}
                  {i.status === "drafted"
                    ? DRAFTED_LABEL
                    : statusLabel(i.status, i.group)}
                  {i.note ? ` (note: ${i.note})` : ""}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="mt-4 text-sm">{GENERAL_INFORMATION_STATEMENT}</p>
      </section>
    </PageShell>
  );
}
