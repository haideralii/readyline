"use client";
import { SUBSCRIPTION_OFF } from "@/lib/payments/copy";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BRAND } from "@/lib/brand";
import { ReadyLine } from "@/components/ready-line";
import {
  readinessCounts,
  readyLineCounts,
  summaryLines,
} from "@/lib/questionnaire/readiness";
import { GlossaryTerms } from "@/components/glossary-terms";
import { findGlossaryTerms } from "@/lib/copy-lint/glossary";
import {
  documentGroupId,
  documentGroupsContent,
  glossarySentence,
} from "@/lib/questionnaire/content";
import { askedDocumentCount } from "@/lib/questionnaire/document-set";
import { stepHref } from "@/lib/questionnaire/navigation";
import { ANSWERS_VERSION } from "@/lib/questionnaire/steps";
import type { QuestionnaireResult } from "@/lib/questionnaire/result";
import { deriveResult, type DeriveResultResponse } from "../../actions";
import { useQuestionnaire } from "../questionnaire-provider";
import {
  HAVE_TAG,
  NEXT_LINE,
  SOLE_TRADER_LINE,
  SOLE_TRADER_SOURCE,
  UNCONFIRMED_SOURCE_HEDGE,
  haveCounts,
  haveLegend,
} from "./result-copy";

/**
 * The result page (REQ-015 Section B): the answer first, in one card that
 * fits a phone screen, with one primary button; everything else folded into
 * three disclosures whose state is remembered on this device (FR-4 to FR-7).
 * The earlier REQ-013 and REQ-014 test ids are kept. REQ-027 A2: the badge
 * words, the legend, the "Next:" line and the sole-trader pair live in
 * `result-copy.ts`; the "What these words mean" disclosure sits under the
 * card with the terms counted at render (D-2701, D-2711).
 */

type Fetch = {
  key: string;
  response: DeriveResultResponse | null;
  failed: boolean;
};

export function ResultStep({
  subscriptionOffered = true,
}: {
  /** Batch 47 item 1: the server page passes `subscriptionAvailable()`; off, the page says the one off-state sentence. */
  subscriptionOffered?: boolean;
}) {
  const { answers, mode, contactEmail } = useQuestionnaire();
  const key = useMemo(() => JSON.stringify(answers), [answers]);
  const [fetched, setFetched] = useState<Fetch>({
    key: "",
    response: null,
    failed: false,
  });

  useEffect(() => {
    let cancelled = false;
    deriveResult({ answersVersion: ANSWERS_VERSION, ...answers })
      .then((r) => {
        if (!cancelled) setFetched({ key, response: r, failed: false });
      })
      .catch(() => {
        if (!cancelled) setFetched({ key, response: null, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [answers, key]);

  const current = fetched.key === key ? fetched : null;

  if (current?.failed) {
    return (
      <p role="alert" className="text-base">
        We could not work out your result just now. Check your connection and
        try again; your answers are still here.
      </p>
    );
  }
  if (!current?.response) {
    return (
      <p role="status" className="text-zinc-600 dark:text-zinc-400">
        Working out which standards apply…
      </p>
    );
  }
  const response = current.response;
  if (!response.ok) {
    return (
      <div
        role="alert"
        className="rounded-md border border-zinc-300 p-4 dark:border-zinc-700"
      >
        <h2 className="text-lg font-semibold">
          We need a change to your answers
        </h2>
        <p className="mt-2 leading-7">
          {response.kind === "derivation"
            ? response.message
            : "Some answers did not pass our checks. Go back and review each step."}
        </p>
        <Link
          href={stepHref("supports")}
          className="mt-4 inline-block underline underline-offset-2"
        >
          Back to the supports step
        </Link>
      </div>
    );
  }

  return (
    <ResultView
      subscriptionOffered={subscriptionOffered}
      result={response.result}
      checklistTotal={response.checklistTotal}
      signedIn={mode === "server"}
      contactEmail={contactEmail}
    />
  );
}

/* ---------- remembered disclosures (FR-7) ---------- */

const OPEN_KEY = "readyline.result.open";

function readOpen(): Set<string> {
  try {
    const raw = localStorage.getItem(OPEN_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(
      Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [],
    );
  } catch {
    return new Set();
  }
}

function useRememberedOpen() {
  // ResultView mounts on the client only (after the result is fetched), so
  // reading storage in the initialiser never differs from a server render.
  const [open, setOpen] = useState<Set<string>>(readOpen);
  // Batch 45b item 3: the write happens in the toggle event's own task. A
  // details toggle is not a discrete event for React, so a render that ran
  // the write from inside the state updater was scheduled for a later task;
  // on a busy CI runner a reload issued straight after the click discarded
  // it and the disclosure came back closed (run 435, Chromium projects).
  // The latest set is mirrored in a ref so two toggles in one task (the
  // mount-time toggle events of several open disclosures) never drop one.
  const latest = useRef(open);
  // Writes the remembered set without touching React state: the click
  // handler calls it in the click's own task (#40, run 38637072132: a reload
  // issued between the click and the later toggle task lost the state once
  // in ten runs). It must not set state, because React would commit the new
  // `open` before the browser's default action, which would then toggle the
  // element straight back.
  const remember = (id: string, isOpen: boolean) => {
    const next = new Set(latest.current);
    if (isOpen) next.add(id);
    else next.delete(id);
    latest.current = next;
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify([...next]));
    } catch {
      // Storage can be blocked; the page still works.
    }
    return next;
  };
  const toggle = (id: string, isOpen: boolean) => {
    setOpen(remember(id, isOpen));
  };
  return { open, toggle, remember };
}

function Disclosure({
  id,
  summary,
  open,
  onToggle,
  onRemember,
  children,
  nested = false,
}: {
  id: string;
  summary: ReactNode;
  open: boolean;
  onToggle: (id: string, open: boolean) => void;
  onRemember: (id: string, open: boolean) => void;
  children: ReactNode;
  nested?: boolean;
}) {
  return (
    <details
      open={open}
      onToggle={(e) => onToggle(id, e.currentTarget.open)}
      // A details element flips `open` on the click itself and fires `toggle`
      // in a later task; a reload issued between the two lost the remembered
      // state once in ten runs (#40, run 38637072132, after 45b item 3 had
      // moved the write out of the state updater). The click handler records
      // the state the click produces, in the click's own task, without
      // setting React state (a commit before the default action would make
      // the browser toggle the element straight back); the toggle handler
      // then sets the state and records the same value again.
      onClick={(e) => {
        // Only this element's own summary: a nested disclosure's click bubbles here too.
        const summary = (e.target as HTMLElement).closest("summary");
        if (!summary || summary.parentElement !== e.currentTarget) return;
        onRemember(id, !e.currentTarget.open);
      }}
      className={
        nested
          ? "mt-2 rounded-md border border-zinc-200 dark:border-zinc-800"
          : "mt-4 rounded-md border border-zinc-300 dark:border-zinc-700"
      }
      data-testid={`result-section-${id}`}
    >
      <summary
        className={
          nested
            ? "min-h-11 cursor-pointer px-3 py-2 text-base font-medium"
            : "min-h-12 cursor-pointer px-4 py-3 text-lg font-semibold"
        }
      >
        {summary}
      </summary>
      <div className={nested ? "px-3 pb-3" : "px-4 pb-4"}>{children}</div>
    </details>
  );
}

/** REQ-027 D-2716, D-2718: a row step 5 did not ask about carries no tag, on both lists; a value the table lacks renders nothing too. */
function HaveTag({ have }: { have: string }) {
  const t = HAVE_TAG[have as keyof typeof HAVE_TAG];
  if (!t) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${t.tone}`}
      data-testid="have-tag"
    >
      <span aria-hidden="true">{t.icon}</span>
      {t.label}
    </span>
  );
}

/**
 * REQ-027 FR-3, D-2711: the glossary terms the page is about to show, found
 * in the strings it renders in the order they first appear, the audit kind's
 * own term left out (it is the page's inline first use under the heading).
 */
function termsPresent(r: QuestionnaireResult, legend: string): string[] {
  const inline = `${r.pathway === "verification" ? "verification" : "certification"}-audit`;
  const text = [
    GROUPS_LABEL,
    ...r.groups.map((g) => g.name),
    ...r.reasons.map((x) => x.text),
    ...(r.flags.silExcluded ? [SIL_EXCLUDED_TEXT] : []),
    ...(r.flags.restrictivePracticesAssumed ? [RP_ASSUMED_TEXT] : []),
    MODULES_HEADING,
    ...r.modules.flatMap((m) => [
      m.name,
      m.description,
      MODULE_STANDARDS_SUMMARY,
      ...m.standards.map((s) => s.name),
    ]),
    MID_TERM_HEADING,
    r.midTermAudit.applies
      ? MID_TERM_APPLIES
      : `${MID_TERM_NONE} ${r.midTermAudit.exemptReason ?? ""}`,
    legend,
    ...r.documents.map((d) => d.title),
    REGISTERS_LEGEND,
    ...r.registers.map((x) => x.title),
    ...(r.flags.soleTrader === true
      ? [
          SOLE_TRADER_LINE,
          UNCONFIRMED_SOURCE_HEDGE,
          SOLE_TRADER_SOURCE.text,
          SOLE_TRADER_SOURCE.source.title,
        ]
      : []),
    WHAT_NEXT_TEXT,
  ].join("\n");
  return findGlossaryTerms(text).filter((id) => id !== inline);
}

const GROUPS_LABEL = "Registration groups in scope";
const MODULE_STANDARDS_SUMMARY = "The standards in this module";
const SIL_EXCLUDED_TEXT =
  "The service you described is not supported independent living under the Commission's definition. Class 0138 and the SIL module are not in your result.";
const RP_ASSUMED_TEXT =
  "You were not sure about restrictive practices, and at least one of your answers to the three helper questions pointed to yes, so we included the implementing behaviour support plans module. Change the answer on the restrictive practices step and the module drops out.";
const MODULES_HEADING = "Practice Standards modules that apply";
const MID_TERM_HEADING = "Mid-term audit";
const MID_TERM_APPLIES =
  "Applies: about N months after registration, against the provider governance and operational management standards. Start preparing from month N.";
const MID_TERM_NONE = "Does not apply.";
const REGISTERS_LEGEND =
  "Your pack includes a template for every register below; the subscription keeps them for you. An auditor samples them at the mid-term audit and at renewal.";
const WHAT_NEXT_TEXT =
  "drafts these documents as a one-off pack; the registers follow as a subscription. Go to your documents if you already have one.";

function ResultView({
  result,
  checklistTotal,
  signedIn,
  contactEmail,
  subscriptionOffered,
}: {
  subscriptionOffered: boolean;
  result: QuestionnaireResult;
  checklistTotal: number;
  signedIn: boolean;
  contactEmail: string | null;
}) {
  const r = result;
  const { open, toggle, remember } = useRememberedOpen();
  const pathwayWord =
    r.pathway === "verification" ? "verification" : "certification";
  const groups = documentGroupsContent.groups
    .map((g) => ({
      ...g,
      items: r.documents.filter((d) => documentGroupId(d.id) === g.id),
    }))
    .filter((g) => g.items.length > 0);
  const checklistHref = signedIn ? "/checklist" : "/sign-in?next=%2Fchecklist";
  // REQ-025 FR-3: the summary as a list over derived counts, never a literal.
  const counts = readinessCounts(r);
  const lines = summaryLines(counts, checklistTotal);
  // REQ-027 D-2718: the legend's numeral; D-2711: the words present, counted at render.
  const legend = haveLegend(askedDocumentCount(r));
  const present = termsPresent(r, legend);

  return (
    <div className="space-y-6" data-testid="result">
      {/* FR-4: the first screen is one card: the answer, one sentence, the counts, the line, one button. */}
      <section
        aria-labelledby="summary-heading"
        className="rounded-md border border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900"
        data-testid="summary"
      >
        <h2 id="summary-heading" className="text-2xl font-semibold">
          Your audit: {pathwayWord}
          {r.modifiedCertification ? " (modified scope)" : ""}
        </h2>
        {/* Batch 42 item 6 (D-549), REQ-025 FR-13: what the word means, from the glossary, in one line under the heading. */}
        <p
          className="mt-1 text-sm text-zinc-700 dark:text-zinc-300"
          data-testid="audit-kind"
        >
          {glossarySentence(`${pathwayWord}-audit`)}
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={GROUPS_LABEL}>
          {r.groups.map((g) => (
            <li
              key={g.code}
              className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
            >
              {g.name}{" "}
              <span className="font-mono text-zinc-500 dark:text-zinc-400">
                {g.code}
              </span>
            </li>
          ))}
        </ul>
        {/* REQ-025 FR-3: the summary as a list, not a sentence; every number derived
            from the result. The phone spacing is 16 px tighter than the wider
            layout so the one button still ends inside the first screen on a
            681 px iPhone (REQ-015 FR-4). REQ-027 A1 (#79's run 38882058792):
            D-2709's certification meaning takes two lines where the old one
            took one, 18 px, so the list's phone line height is 24 px over its
            five lines (28 px from sm up) and the button ends inside the screen
            again with every word kept. */}
        <ul
          className="mt-2 space-y-1 text-base leading-6 sm:mt-3 sm:leading-7"
          data-testid="summary-list"
        >
          <li data-testid="summary-documents">{lines.documents}</li>
          <li data-testid="summary-registers">{lines.registers}</li>
          {/* REQ-027 FR-3a (finding 33): one sign-in nudge per card, the "Next:" line's. */}
          <li data-testid="checklist-count-line">{lines.checklist}</li>
        </ul>
        {/* REQ-013 batch 36 item 3: two segments (have / still to do); the sentence is the pack line (REQ-025 FR-3). */}
        <div className="mt-2 sm:mt-3">
          <ReadyLine
            counts={readyLineCounts(counts)}
            sentence={lines.pack}
            testId="result-ready-line"
          />
        </div>
        {/* REQ-017 step 1: one button that starts the path; the checklist and the price stay as plain links. */}
        <div data-testid="checklist-teaser">
          <div className="mt-3 flex flex-col gap-3 sm:mt-4 sm:flex-row sm:items-center">
            <Link
              href={
                signedIn
                  ? "/path/before-you-buy"
                  : "/sign-in?next=%2Fpath%2Fbefore-you-buy"
              }
              className="btn-primary"
              data-testid="start-getting-ready"
            >
              Start getting ready
            </Link>
            <Link
              href={checklistHref}
              className="inline-flex min-h-11 items-center underline underline-offset-4"
              data-testid={signedIn ? "checklist-link" : "checklist-sign-in"}
            >
              Open your checklist ({checklistTotal} things)
            </Link>
            <Link
              href="/pricing#start"
              className="inline-flex min-h-11 items-center underline underline-offset-4"
              data-testid="result-buy-link"
            >
              See the price
            </Link>
          </div>
          {/* REQ-027 FR-3a, D-2707: signed out, what happens next in one line under the primary action; signed in, the REQ-017 strip says it. */}
          {signedIn ? null : (
            <p
              className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300"
              data-testid="next-line"
            >
              {NEXT_LINE}
            </p>
          )}
        </div>
      </section>

      {/* REQ-027 D-2701, D-2711: the one disclosure for the words on this page, under the card and inside no other
          disclosure, listing the terms present at render minus the audit kind the heading already explains. */}
      <GlossaryTerms ids={present} where="result" className="mt-2" />

      {/* FR-5: three closed disclosures with counts in their summaries. */}
      <Disclosure
        id="why"
        open={open.has("why")}
        onToggle={toggle}
        onRemember={remember}
        summary={`Why this result (${r.reasons.length} reason${r.reasons.length === 1 ? "" : "s"}, with sources)`}
      >
        {r.flags.silExcluded ? (
          <p
            className="mt-2 rounded-md border border-zinc-300 bg-zinc-50 p-3 text-sm leading-6 dark:border-zinc-700 dark:bg-zinc-900"
            data-testid="sil-excluded"
          >
            {SIL_EXCLUDED_TEXT}
          </p>
        ) : null}
        {r.flags.restrictivePracticesAssumed ? (
          <p className="mt-2 rounded-md border border-zinc-300 bg-zinc-50 p-3 text-sm leading-6 dark:border-zinc-700 dark:bg-zinc-900">
            {RP_ASSUMED_TEXT}
          </p>
        ) : null}
        {r.flags.largeProvider ? (
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {BRAND} focuses on providers with up to about 10 workers. The
            standards below still apply to you.
          </p>
        ) : null}
        {/* REQ-025 FR-5: one list item per reason, the source as the link text; "opens in a new tab" said once. */}
        <p
          className="mt-2 text-sm text-zinc-600 dark:text-zinc-400"
          data-testid="reasons-intro"
        >
          Each reason links to its source; the sources open in a new tab.
        </p>
        <ul className="mt-2 space-y-2">
          {r.reasons.map((x, i) => (
            <li
              key={`${x.rule}-${i}`}
              className="text-sm leading-6"
              data-testid="reason"
            >
              {/* REQ-013 batch 36 item 2: a plain sentence and the link, never the internal confidence badge. */}
              {x.unverified
                ? "Check this against the Commission's page before you rely on it. "
                : ""}
              {x.text}{" "}
              <a
                href={x.source.url}
                className="underline underline-offset-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                {x.source.title}
              </a>
            </li>
          ))}
        </ul>
        <h3 className="mt-5 text-base font-semibold">
          {MODULES_HEADING} ({r.modules.length})
        </h3>
        <ul className="mt-2 space-y-3">
          {r.modules.map((m) => (
            <li
              key={m.id}
              className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
              data-testid={`module-${m.id}`}
            >
              <p className="text-base font-medium">
                {m.name}{" "}
                <span className="font-normal text-zinc-600 dark:text-zinc-400">
                  ({m.standardCount} standards)
                </span>
              </p>
              <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                {m.description}
              </p>
              <details className="mt-1">
                <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium underline-offset-4 hover:underline">
                  {MODULE_STANDARDS_SUMMARY}
                </summary>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {m.standards.map((s) => (
                    <li key={s.id}>{s.name}</li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
        <h3 className="mt-5 text-base font-semibold">{MID_TERM_HEADING}</h3>
        <p className="mt-1 text-sm leading-6" data-testid="mid-term">
          {r.midTermAudit.applies
            ? MID_TERM_APPLIES.replace(
                "about N months",
                `about ${r.midTermAudit.monthsAfterRegistration} months`,
              ).replace("month N.", `month ${r.midTermAudit.prepareFromMonth}.`)
            : `${MID_TERM_NONE} ${r.midTermAudit.exemptReason ?? ""}`}
        </p>
      </Disclosure>

      <Disclosure
        id="documents"
        open={open.has("documents")}
        onToggle={toggle}
        onRemember={remember}
        summary={`Documents you will need (${r.documents.length})`}
      >
        {/* REQ-025 FR-4a, REQ-027 D-2718 and D-2722: the pack's part and the reader's own answers, five sentences above the list, never per row. */}
        <p
          className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400"
          data-testid="have-legend"
        >
          {legend}
        </p>
        {groups.map((g) => (
          <Disclosure
            key={g.id}
            id={`doc-group-${g.id}`}
            nested
            open={open.has(`doc-group-${g.id}`)}
            onToggle={toggle}
            onRemember={remember}
            summary={
              <>
                {g.title} ({g.items.length}
                {haveCounts(g.items) ? `: ${haveCounts(g.items)}` : ""})
              </>
            }
          >
            {/* REQ-027 D-2716, D-2723: for a sole trader, the "Your workers" group opens with the rule and its source, in the reasons' convention. */}
            {g.id === "your-workers" && r.flags.soleTrader === true ? (
              <div
                className="mt-2 text-sm leading-6"
                data-testid="sole-trader-line"
              >
                <p>{SOLE_TRADER_LINE}</p>
                <p className="mt-1 text-zinc-700 dark:text-zinc-300">
                  {UNCONFIRMED_SOURCE_HEDGE} {SOLE_TRADER_SOURCE.text}{" "}
                  <a
                    href={SOLE_TRADER_SOURCE.source.url}
                    className="underline underline-offset-2"
                    data-testid="sole-trader-source"
                  >
                    {SOLE_TRADER_SOURCE.source.title}
                  </a>
                </p>
              </div>
            ) : null}
            <ul
              className="divide-y divide-zinc-200 dark:divide-zinc-800"
              data-testid={`doc-group-${g.id}`}
            >
              {g.items.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2"
                >
                  <span className="text-base">{d.title}</span>
                  <HaveTag have={d.have} />
                </li>
              ))}
            </ul>
          </Disclosure>
        ))}
      </Disclosure>

      <Disclosure
        id="registers"
        open={open.has("registers")}
        onToggle={toggle}
        onRemember={remember}
        summary={`Registers to keep (${r.registers.length})`}
      >
        <p
          className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400"
          data-testid="registers-legend"
        >
          {REGISTERS_LEGEND}
        </p>
        <ul className="mt-2 divide-y divide-zinc-200 dark:divide-zinc-800">
          {r.registers.map((x) => (
            <li
              key={x.id}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2"
            >
              <span className="text-base">{x.title}</span>
              <HaveTag have={x.have} />
            </li>
          ))}
        </ul>
      </Disclosure>

      {/* Batch 45 item 9 (D-2001): the two offers as halves of equal weight, the subscription first.
          REQ-027 FR-4 (decision 9 of the third pass): below the disclosures and above "What happens
          next", because a first-time reader does not need the price before the result. */}
      <dl
        className="grid gap-2 rounded-md border border-zinc-200 p-4 text-sm sm:grid-cols-2 dark:border-zinc-800"
        data-testid="result-two-halves"
      >
        <div>
          <dt className="font-semibold">What keeps you audit-ready</dt>
          {subscriptionOffered ? (
            <dd className="text-zinc-700 dark:text-zinc-300">
              The registers and reminders, a monthly subscription with the
              evidence already in place at renewal.{" "}
              <Link
                href="/pricing#keeps"
                className="underline underline-offset-2"
              >
                The subscription
              </Link>
              .
            </dd>
          ) : (
            <dd
              className="text-zinc-700 dark:text-zinc-300"
              data-testid="result-subscription-off"
            >
              The registers and reminders, with the evidence already in place at
              renewal. {SUBSCRIPTION_OFF}
            </dd>
          )}
        </div>
        <div>
          <dt className="font-semibold">Where you start</dt>
          <dd className="text-zinc-700 dark:text-zinc-300">
            The document pack, one price paid once; nothing is bundled and
            nothing is discounted.{" "}
            <Link
              href="/pricing#start"
              className="underline underline-offset-2"
            >
              The pack
            </Link>
            .
          </dd>
        </div>
      </dl>

      <section
        aria-labelledby="next-heading"
        className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
        data-testid="what-next"
      >
        <h2 id="next-heading" className="text-lg font-semibold">
          What happens next
        </h2>
        <p className="mt-2 text-sm leading-6">
          {BRAND} drafts these documents as a one-off pack
          {subscriptionOffered
            ? "; the registers follow as a subscription."
            : `. ${SUBSCRIPTION_OFF}`}{" "}
          <Link href="/documents" className="underline underline-offset-2">
            Go to your documents
          </Link>{" "}
          if you already have one.
        </p>
      </section>

      <p
        className="text-sm leading-6 text-zinc-600 dark:text-zinc-400"
        data-testid="result-notice"
      >
        {r.notice}
      </p>

      {/* REQ-013 FR-9, REQ-015 FR-6: one line, the address as a link. */}
      <p
        className="text-sm leading-6 text-zinc-700 dark:text-zinc-300"
        data-testid="result-contact"
      >
        Questions about your result?{" "}
        {contactEmail ? (
          <>
            Email{" "}
            <a
              href={`mailto:${contactEmail}`}
              className="underline underline-offset-2"
            >
              {contactEmail}
            </a>
            .
          </>
        ) : (
          "Email the contact address in the footer."
        )}{" "}
        We answer product and process questions, not legal ones.
      </p>
    </div>
  );
}
