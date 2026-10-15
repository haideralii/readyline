import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GENERAL_INFORMATION_STATEMENT } from "@/lib/brand";
import { deriveChecklist } from "@/lib/checklist/derive";
import { mergeChecklist, type ShownItem } from "@/lib/checklist/state";
import { orderDocuments } from "@/lib/generator/set-order";
import { auditKindsContent } from "@/lib/questionnaire/content";
import { auditDayAskList } from "@/lib/registers/audit-day-ask";
import { AUDIT_RECORD_TIER_TITLES, KEPT_ON_PAPER } from "@/lib/registers/names";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { getViewer } from "@/server/accounts/queries";
import {
  listChecklistItems,
  listDraftedDocumentTypeIds,
} from "@/server/checklist/queries";
import { loadPathContext } from "@/server/path/state";
import { auditDayOverview } from "@/server/registers/audit-day-queries";
import { documentControlForAccount } from "@/server/registers/document-control-queries";
import { registerOverview } from "@/server/registers/queries";
import {
  lastSelfCheck,
  openSelfCheckFindings,
} from "@/server/registers/self-check-queries";
import { selfCheckOffer } from "@/lib/registers/self-check";
import { createSupabaseServerClient } from "@/server/supabase/server";
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

export default async function AuditDayPage() {
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
  const [stored, drafted, registers, auditDay, documentControl, drill] =
    await Promise.all([
      listChecklistItems(supabase, viewer.account.id),
      listDraftedDocumentTypeIds(supabase, viewer.account.id),
      registerOverview(supabase, viewer.account.id),
      auditDayOverview(supabase, viewer.account.id),
      documentControlForAccount(supabase, viewer.account.id),
      supabase
        .from("accounts")
        .select("last_emergency_drill_on")
        .eq("id", viewer.account.id)
        .maybeSingle(),
    ]);
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
  const shown = mergeChecklist({
    checklist: deriveChecklist(ctx.result, ctx.answers, dataset),
    stored,
    draftedDocumentTypeIds: drafted,
  });
  const setId = ctx.state.readySetId;
  const groups = setId ? orderDocuments(ctx.documents) : [];
  const have = shown.items.filter((i) => i.status === "have").length;
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-semibold tracking-tight">
        Audit day: {viewer.account.trading_name}
      </h1>
      <p className="mt-3 leading-7" data-testid="audit-day-summary">
        {ctx.result.pathway === "verification"
          ? "The auditor reads your documents at their desk and may phone you with questions. "
          : "The auditor visits, reads your documents, and talks to you, your workers and some participants. "}
        You have {have} of {shown.total} things ready. Print this page and keep
        it with your pack.
      </p>
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
            <h2 id={`ask-${g.id}`} className="text-xl font-semibold">
              {ASK[g.id] ?? g.title}
            </h2>
            <ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
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
                      <span className="text-zinc-700 dark:text-zinc-300">
                        {t.word}
                      </span>
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
          <h2 id="pack-heading" className="text-xl font-semibold">
            The documents in your pack
          </h2>
          {groups.map((g) => (
            <div key={g.title} className="mt-3">
              <h3 className="text-base font-semibold">{g.title}</h3>
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
        <h2 id="ask-records-heading" className="text-xl font-semibold">
          What the auditor will ask to see
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          Policies are one third of an audit. The rest is records: a register
          with every field filled and a review date on every row. A record
          marked &quot;{KEPT_ON_PAPER}&quot; is a signed or issued document you
          keep in your folder; the register holds its dates.
        </p>
        {/* Batch 45 (REQ-018-gated item): the twelve in their two tiers, the paper records marked. */}
        {(["named", "practice"] as const).map((tier) => (
          <div key={tier} data-testid={`ask-tier-${tier}`}>
            <h3 className="mt-5 text-base font-semibold">
              {AUDIT_RECORD_TIER_TITLES[tier]}
            </h3>
            <ol className="mt-1 divide-y divide-zinc-200 dark:divide-zinc-800">
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
                        <span className="text-zinc-700 dark:text-zinc-300">
                          ({KEPT_ON_PAPER})
                        </span>
                      ) : null}{" "}
                      <span className="text-zinc-700 dark:text-zinc-300">
                        {a.word}
                      </span>{" "}
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
        <h2 id="check-heading" className="text-xl font-semibold">
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
        <h2 id="drill-heading" className="text-xl font-semibold">
          Your emergency drill
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
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
        <h2 id="kinds-heading" className="text-xl font-semibold">
          The kinds of audit, in plain words
        </h2>
        <dl className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
          {auditKindsContent.items.map((k) => (
            <div key={k.id} className="py-3" data-testid={`audit-kind-${k.id}`}>
              <dt className="font-medium">{k.name}</dt>
              <dd className="leading-7 text-zinc-700 dark:text-zinc-300">
                {k.description}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <p className="mt-10 text-xs text-zinc-600 dark:text-zinc-400">
        {GENERAL_INFORMATION_STATEMENT}
      </p>
    </div>
  );
}
