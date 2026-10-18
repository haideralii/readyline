import { PageShell } from "@/components/page-shell";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GENERAL_INFORMATION_STATEMENT } from "@/lib/brand";
import { checklistPeriod, deriveChecklist } from "@/lib/checklist/derive";
import { mergeChecklist, type ShownItem } from "@/lib/checklist/state";
import { applyWorkerStates } from "@/lib/checklist/worker-states";
import { workerStatesLine } from "@/lib/registers/worker-states-line";
import { legalRows, timelineRows } from "@/lib/registers/timeline";
import {
  parsePeriodParams,
  periodContextFrom,
  periodQuery,
  resolvePeriod,
  type RawPeriodParams,
} from "@/lib/registers/period";
import { PeriodSelector } from "@/components/period-selector";
import { RegistrationTimeline } from "@/app/account/registration-timeline";
import { orderDocuments } from "@/lib/generator/set-order";
import { auditKindsContent } from "@/lib/questionnaire/content";
import { auditDayAskList } from "@/lib/registers/audit-day-ask";
import { reportsToConfirmLine } from "@/lib/registers/worker";
import { AUDIT_RECORD_TIER_TITLES, KEPT_ON_PAPER } from "@/lib/registers/names";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { getViewer } from "@/server/accounts/queries";
import {
  listChecklistItems,
  listDraftedDocumentTypeIds,
} from "@/server/checklist/queries";
import { loadPathContext } from "@/server/path/state";
import {
  auditDayOverview,
  listAuditDayRows,
} from "@/server/registers/audit-day-queries";
import { findingsCardLine } from "@/lib/registers/findings";
import { gapCheckCardLine } from "@/lib/gap-check/words";
import { gapCheckSummary, listGapChecks } from "@/server/gap-check/queries";
import type { FindingListRow } from "@/lib/registers/findings";
import { documentControlForAccount } from "@/server/registers/document-control-queries";
import { registerOverview } from "@/server/registers/queries";
import { latestOwnershipChangeOn } from "@/server/registers/commission-changes-queries";
import { currentPeriod } from "@/server/registers/registration-queries";
import { latestRegisterChangeAt } from "@/server/registers/what-changed-queries";
import { whatChangedReading } from "@/lib/path/renewal";
import {
  lastSelfCheck,
  openSelfCheckFindings,
} from "@/server/registers/self-check-queries";
import { selfCheckOffer } from "@/lib/registers/self-check";
import { countReportsToConfirm } from "@/server/registers/team-queries";
import { createSupabaseServerClient } from "@/server/supabase/server";
import {
  accountWorkerStates,
  todaySydney,
} from "@/server/registers/worker-onboarding";
import { DrillForm } from "./drill-form";

export const metadata: Metadata = { title: "Audit day" };

/**
 * Step 7, the audit-day page (REQ-017 FR-3, D-1703): what the auditor will
 * ask for, in the order they ask (your business, your documents, your
 * registers, your people, the audit itself), written as the conversation,
 * with a tick for each thing the provider has, the pack download and the
 * readiness summary. Printable: the print sheet keeps the list.
 */
const ASK: Record<string, string> = {
  business: "First they check who you are",
  documents: "Then they ask to see your policies",
  registers: "Then they ask for your records",
  people: "Then they ask about your workers",
  audit: "Then they talk about the audit itself",
};

function tick(item: ShownItem): { mark: string; word: string } {
  if (item.status === "have") return { mark: "✓", word: "You have it." };
  if (item.status === "drafted" || item.status === "in-progress")
    return { mark: "◐", word: "Nearly there." };
  return { mark: "○", word: "Not yet." };
}

export default async function AuditDayPage({
  searchParams,
}: PageProps<"/path/audit-day">) {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=%2Fpath%2Faudit-day");
  if (viewer.deleted) redirect("/account/deleted");
  if (!viewer.account) redirect("/account/setup");
  const supabase = await createSupabaseServerClient();
  const ctx = await loadPathContext(supabase, {
    ...viewer,
    account: viewer.account,
  });
  if (!ctx.result || !ctx.answers) redirect("/start");
  const dataset = getStandardsDataset();
  const [
    stored,
    drafted,
    registers,
    auditDay,
    documentControl,
    toConfirm,
    drill,
    period,
    workers,
    ownershipChangeOn,
    latestChangeAt,
    findingRows,
    gapRows,
  ] = await Promise.all([
    listChecklistItems(supabase, viewer.account.id),
    listDraftedDocumentTypeIds(supabase, viewer.account.id),
    registerOverview(supabase, viewer.account.id),
    auditDayOverview(supabase, viewer.account.id),
    documentControlForAccount(supabase, viewer.account.id),
    countReportsToConfirm(supabase, viewer.account.id),
    supabase
      .from("accounts")
      .select("last_emergency_drill_on")
      .eq("id", viewer.account.id)
      .maybeSingle(),
    // REQ-023 FR-2, FR-4: the registration period's legal rows and dated items.
    currentPeriod(supabase, viewer.account.id),
    // REQ-024 Session C (FR-10; D-2411, D-2831): every worker's derived state, for the people group and the two people items.
    accountWorkerStates(
      supabase,
      viewer.account.id,
      viewer.user.id,
      ctx.result,
      todaySydney(),
    ),
    // REQ-023 FR-2, FR-4 (Session D): the change-of-ownership row and item read the changes register.
    latestOwnershipChangeOn(supabase, viewer.account.id),
    // REQ-031 FR-5 (D-2890): the newest register change, for the what-changed link's words.
    latestRegisterChangeAt(supabase, viewer.account.id),
    // REQ-033 FR-6: the findings from the last audit, for the card.
    listAuditDayRows(supabase, viewer.account.id, "findings"),
    // REQ-035 FR-5: the owner's gap checks, for the documents card's count.
    listGapChecks(supabase, viewer.account.id),
  ]);
  const gapSummary = gapCheckSummary(gapRows);
  const peopleLine = workerStatesLine(workers, todaySydney());
  // REQ-023 FR-5: the period the pack link carries, "This registration period"
  // by default when a period exists (D-2305); the list's states stay live
  // (D-2318 B). The proxy refused a malformed query already.
  const parsedPeriod = parsePeriodParams(
    (await searchParams) as RawPeriodParams,
  );
  const periodCtx = periodContextFrom(period);
  const packPeriod = resolvePeriod(
    parsedPeriod.ok ? parsedPeriod.selection : null,
    periodCtx,
    "period",
  );
  // REQ-018 FR-11: the twelve records with the live state of each register (D-1907).
  const asks = auditDayAskList({
    registers,
    auditDay,
    documentControl: documentControl.rows,
  });
  const lastDrill =
    (drill.data as { last_emergency_drill_on: string | null } | null)
      ?.last_emergency_drill_on ?? null;
  // REQ-020 FR-9: the last walk and its open findings.
  const [lastWalk, openFindings] = await Promise.all([
    lastSelfCheck(supabase, viewer.account.id),
    openSelfCheckFindings(supabase, viewer.account.id),
  ]);
  const selfCheck = selfCheckOffer({
    lastWalkedOn: lastWalk?.walked_on ?? null,
    lastFindings: lastWalk?.findings ?? 0,
    openFindings,
    today: new Intl.DateTimeFormat("en-CA", {
      timeZone: "Australia/Sydney",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
  });
  const shown = applyWorkerStates(
    mergeChecklist({
      checklist: deriveChecklist(
        ctx.result,
        ctx.answers,
        dataset,
        checklistPeriod(period, ownershipChangeOn),
      ),
      stored,
      draftedDocumentTypeIds: drafted,
    }),
    workers,
    todaySydney(),
  );
  const setId = ctx.state.readySetId;
  const groups = setId ? orderDocuments(ctx.documents) : [];
  const have = shown.items.filter((i) => i.status === "have").length;
  return (
    <PageShell kind="list">
      <h1 className="">Audit day: {viewer.account.trading_name}</h1>
      <p className="mt-3 leading-7" data-testid="audit-day-summary">
        {ctx.result.pathway === "verification"
          ? "The auditor reads your documents at their desk and may phone you with questions. "
          : "The auditor visits, reads your documents, and talks to you, your workers and some participants. "}
        You have {have} of {shown.total} things ready. Print this page and keep
        it with your pack.
      </p>
      {reportsToConfirmLine(toConfirm) ? (
        // REQ-020 FR-5: the owner sees a waiting report here too, one tap from confirming it.
        <p
          className="border-signal mt-3 rounded-md border p-4 leading-7 print:hidden"
          data-testid="audit-day-reports"
        >
          <Link
            href="/registers/incidents"
            className="font-medium underline underline-offset-4"
          >
            {reportsToConfirmLine(toConfirm)}
          </Link>
          . Confirm it before the audit; it is not in your register until you
          do.
        </p>
      ) : null}
      <p className="mt-4 print:hidden">
        {setId ? (
          <a
            href={`/documents/${setId}/download?file=set.zip`}
            className="btn-primary"
            data-testid="audit-day-download"
          >
            Download my pack
          </a>
        ) : (
          <Link href="/documents" className="btn-primary">
            Get my documents
          </Link>
        )}
      </p>
      {setId ? (
        <p className="mt-3 text-sm print:hidden">
          <a
            href={`/documents/${setId}/download?file=readiness-summary.pdf`}
            className="underline underline-offset-2"
          >
            Readiness summary (PDF)
          </a>
        </p>
      ) : null}
      {/* REQ-023 FR-2 (D-2314): the dates the Rules and the Act fix, the period end and the done dates; the suggestions stay on the account page. */}
      {period ? (
        <section
          aria-labelledby="registration-dates-heading"
          className="mt-6"
          data-testid="audit-day-registration"
        >
          <h2 id="registration-dates-heading" className="">
            Your registration dates
          </h2>
          <RegistrationTimeline
            rows={legalRows(timelineRows(period, { ownershipChangeOn }))}
            caption="Your registration dates, from your certificate, the Rules and the Act"
            testId="audit-day-timeline"
          />
        </section>
      ) : null}
      {/* REQ-020 FR-1: everything the auditor asks for, in one zip, built when you click. */}
      <p className="mt-3 text-sm print:hidden">
        <a
          href={`/registers/audit-pack.zip${periodQuery(packPeriod.period, { explicitAll: true })}`}
          className="underline underline-offset-2"
          data-testid="audit-pack-download"
        >
          Download my audit pack (every register, the document control register,
          the summary and the adopted documents)
        </a>
      </p>
      {/* REQ-023 FR-5: the period the pack's four registers cover; the states on this page stay the whole register's. */}
      {period ? (
        <PeriodSelector
          basePath="/path/audit-day"
          period={packPeriod.period}
          ctx={periodCtx}
          unavailable={packPeriod.unavailable}
          fallback="period"
          testId="audit-day-period"
        />
      ) : (
        // #99 run 1 (PO 01:10): a real owner lands here before the dates are in; the line says what the pack covers and why.
        <p
          className="mt-4 text-sm print:hidden"
          data-testid="audit-day-period-line"
        >
          Showing: <span className="font-medium">All entries</span> (enter your
          registration dates on the account page to filter by period).
        </p>
      )}
      {/* REQ-033 FR-6: the findings from the last audit, counted by the provider's record. */}
      {findingRows.length > 0 ? (
        <p
          className="mt-3 text-sm print:hidden"
          data-testid="audit-day-findings"
        >
          <Link
            href="/registers/findings"
            className="underline underline-offset-2"
          >
            {findingsCardLine(findingRows as unknown as FindingListRow[])}
          </Link>
        </p>
      ) : null}
      {/* REQ-035 FR-5 (D-2966): the provider's own policies checked against the outline, and the sections left to close. */}
      {gapSummary.checked > 0 ? (
        <p
          className="mt-3 text-sm print:hidden"
          data-testid="audit-day-gap-checks"
        >
          <Link
            href="/documents/gap-check"
            className="underline underline-offset-2"
          >
            {gapCheckCardLine(gapSummary.checked, gapSummary.toClose)}
          </Link>
        </p>
      ) : null}
      {/* REQ-023 FR-6: the summary screen, the same sheet the pack carries. */}
      {period ? (
        <p className="mt-3 text-sm print:hidden">
          <Link
            href="/path/audit-day/what-changed"
            className="underline underline-offset-2"
            data-testid="audit-day-what-changed"
          >
            {period.last_audit_on
              ? "What changed since the last audit"
              : "What changed in this registration period"}{" "}
            {/* REQ-031 FR-5 (D-2890): the renewal step's words, so the link says whether it has been read. */}
            <span data-testid="audit-day-what-changed-state">
              (
              {
                whatChangedReading(
                  period.what_changed_read_at ?? null,
                  latestChangeAt,
                ).state
              }
              )
            </span>
          </Link>
        </p>
      ) : null}
      {/* REQ-023 FR-7 (Session C): the renewal path, the ten steps in the Commission's order. */}
      <p className="mt-2 text-sm print:hidden">
        <Link
          href="/path/renewal"
          className="underline underline-offset-2"
          data-testid="audit-day-renewal"
        >
          Your renewal path
        </Link>
      </p>

      {/* Batch 45 item 3: the groups in the order the auditor asks, not the checklist's. */}
      {[...shown.groups]
        .sort(
          (a, b) =>
            Object.keys(ASK).indexOf(a.id) - Object.keys(ASK).indexOf(b.id),
        )
        .map((g) => (
          <section
            key={g.id}
            aria-labelledby={`ask-${g.id}`}
            className="mt-10"
            data-testid="audit-day-group"
          >
            <h2 id={`ask-${g.id}`} className="">
              {ASK[g.id] ?? g.title}
            </h2>
            {g.id === "people" && peopleLine ? (
              // REQ-024 Session C (FR-10; D-2411): the staff list's derived states in one line, with the way to them.
              <p
                className="mt-2 text-sm leading-6"
                data-testid="audit-day-people-line"
              >
                From your staff list: {peopleLine}.{" "}
                <Link
                  href="/registers/staff-matrix"
                  className="underline underline-offset-2"
                >
                  Open the staff list
                </Link>
                .
              </p>
            ) : null}
            <ul className="divide-rule mt-3 divide-y">
              {g.items.map((i) => {
                const t = tick(i);
                return (
                  <li key={i.id} className="flex gap-3 py-3 leading-7">
                    <span aria-hidden="true" className="w-5 shrink-0">
                      {t.mark}
                    </span>
                    <span>
                      {/* Batch 45 item 4: what the auditor says, never the provider's instruction. */}
                      <span className="font-medium">&quot;{i.ask}&quot;</span>{" "}
                      <span className="text-ink">{t.word}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

      {groups.length ? (
        <section
          aria-labelledby="pack-heading"
          className="mt-10"
          data-testid="audit-day-pack"
        >
          <h2 id="pack-heading" className="">
            The documents in your pack
          </h2>
          {groups.map((g) => (
            <div key={g.title} className="mt-3">
              <h3 className="">{g.title}</h3>
              <ul className="mt-1 list-disc pl-5 leading-7">
                {g.documents.map((d) => (
                  <li key={d.id}>
                    {d.model.title}
                    {ctx.adopted.has(d.document_type_id) ? " (adopted)" : ""}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}
      {/* REQ-018 FR-11, AC-4: the twelve records, each with its live state and a tap to fix it. */}
      <section
        aria-labelledby="ask-records-heading"
        className="mt-10"
        data-testid="audit-day-ask"
      >
        <h2 id="ask-records-heading" className="">
          What the auditor will ask to see
        </h2>
        <p className="text-ink mt-2 text-sm leading-6">
          Policies are one third of an audit. The rest is records: a register
          with every field filled and a review date on every row. A record
          marked &quot;{KEPT_ON_PAPER}&quot; is a signed or issued document you
          keep in your folder; the register holds its dates.
        </p>
        {/* Batch 45 (REQ-018-gated item): the twelve in their two tiers, the paper records marked. */}
        {(["named", "practice"] as const).map((tier) => (
          <div key={tier} data-testid={`ask-tier-${tier}`}>
            <h3 className="mt-5">{AUDIT_RECORD_TIER_TITLES[tier]}</h3>
            <ol className="divide-rule mt-1 divide-y">
              {asks
                .filter((a) => a.tier === tier)
                .map((a) => (
                  <li
                    key={a.id}
                    className="flex gap-3 py-3 leading-7"
                    data-testid={`ask-${a.id}`}
                    data-state={a.state}
                  >
                    <span aria-hidden="true" className="w-5 shrink-0">
                      {a.state === "filled"
                        ? "✓"
                        : a.state === "overdue"
                          ? "!"
                          : "○"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">
                        &quot;Show me: {a.ask}.&quot;
                      </span>{" "}
                      {a.paper ? (
                        <span className="text-ink">({KEPT_ON_PAPER})</span>
                      ) : null}{" "}
                      <span className="text-ink">{a.word}</span>{" "}
                      <Link
                        href={a.href}
                        className="underline underline-offset-2 print:hidden"
                        data-testid={`ask-link-${a.id}`}
                      >
                        {a.action}
                      </Link>
                    </span>
                  </li>
                ))}
            </ol>
          </div>
        ))}
      </section>

      {/* REQ-020 FR-9: the quarterly self-check, offered every three months and on demand. */}
      <section
        aria-labelledby="check-heading"
        className="border-ochre mt-10 rounded-md border p-4 print:hidden"
        data-testid="audit-day-check"
        data-due={selfCheck.due ? "true" : "false"}
      >
        <h2 id="check-heading" className="">
          Check my systems
        </h2>
        <p
          className="mt-2 leading-7 print:hidden"
          data-testid="audit-day-check-line"
        >
          {selfCheck.line}
        </p>
        <p className="mt-3 print:hidden">
          {/* Secondary: the page's one primary button is the next step (REQ-017 FR-5). */}
          <Link
            href="/path/audit-day/check"
            className="btn-secondary"
            data-testid="audit-day-check-start"
          >
            {lastWalk ? "Check my systems again" : "Check my systems"}
          </Link>
        </p>
      </section>

      {/* REQ-018 FR-10: the emergency drill date the reminder counts from. */}
      <section aria-labelledby="drill-heading" className="mt-10">
        <h2 id="drill-heading" className="">
          Your emergency drill
        </h2>
        <p className="text-ink mt-2 text-sm leading-6">
          {lastDrill
            ? `Last drill ${lastDrill}. Run one every six months and record it here.`
            : "No drill recorded yet. Walk through your emergency plan with your workers, then record the date here."}
        </p>
        <DrillForm last={lastDrill} />
      </section>

      {/* REQ-018 FR-11, AC-4: the five kinds of audit in plain words. */}
      <section
        aria-labelledby="kinds-heading"
        className="mt-10"
        data-testid="audit-kinds"
      >
        <h2 id="kinds-heading" className="">
          The kinds of audit, in plain words
        </h2>
        <dl className="divide-rule mt-3 divide-y">
          {auditKindsContent.items.map((k) => (
            <div key={k.id} className="py-3" data-testid={`audit-kind-${k.id}`}>
              <dt className="font-medium">{k.name}</dt>
              <dd className="text-ink leading-7">{k.description}</dd>
            </div>
          ))}
        </dl>
      </section>
      <p className="text-slate mt-10 text-sm">
        {GENERAL_INFORMATION_STATEMENT}
      </p>
    </PageShell>
  );
}
