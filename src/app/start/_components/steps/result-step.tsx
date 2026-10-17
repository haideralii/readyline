"use client";
import { SUBSCRIPTION_OFF } from "@/lib/payments/copy";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/confirm-button";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BRAND } from "@/lib/brand";
import { Disclosure as SharedDisclosure } from "@/components/disclosure";
import { ReadyLine } from "@/components/ready-line";
import { Tag, type TagVariant } from "@/components/tag";
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
import {
  deriveResult,
  type DeriveResultResponse,
  type ResultChanges,
} from "../../actions";
import { useQuestionnaire } from "../questionnaire-provider";
import {
  HAVE_TAG,
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
    // REQ-028 AC-10 (D-2280): the view mounts on the client after the draft is read, so the loading state
    // reserves a viewport's height and the footer starts below the fold; when the view arrives nothing
    // visible moves (CLS 0.51 before, with the footer climbing into view and back down).
    return (
      <div className="min-h-screen" aria-busy="true">
        <p role="status" className="text-slate">
          Working out which standards apply…
        </p>
      </div>
    );
  }
  const response = current.response;
  if (!response.ok) {
    return (
      <div role="alert" className="border-rule rounded-md border p-4">
        <h2 className="">We need a change to your answers</h2>
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
      changes={response.changes}
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
  // REQ-028 FR-6 (D-2813): whether this device remembers anything; with nothing remembered the three sections
  // follow OpenOnLarge's mount rule (open at lg, closed under it) until the person toggles one.
  const [known] = useState<boolean>(() => {
    try {
      return localStorage.getItem(OPEN_KEY) !== null;
    } catch {
      return false;
    }
  });
  // Batch 45b item 3: the write happens in the toggle event's own task. A
  // details toggle is not a discrete event for React, so a render that ran
  // the write from inside the state updater was scheduled for a later task;
  // on a busy CI runner a reload issued straight after the click discarded
  // it and the disclosure came back closed (run 435, Chromium projects).
  // The latest set is mirrored in a ref so two toggles in one task (the
  // mount-time toggle events of several open disclosures) never drop one.
  const latest = useRef(open);
  // REQ-028 FR-6 (D-2813): until this device remembers anything, the sections shown open are OpenOnLarge's,
  // not the set's; the first write starts from what the page shows (the three top-level sections' DOM state)
  // so closing one at lg does not forget the other two. Read before the toggled id is applied: the summary
  // click records in its own task, before the browser toggles the element.
  const seeded = useRef(known);
  const shown = (): Set<string> => {
    const ids = new Set<string>();
    if (typeof document === "undefined") return ids;
    for (const d of document.querySelectorAll<HTMLDetailsElement>(
      'details[data-testid^="result-section-"]',
    ))
      if (d.open) ids.add(d.dataset.testid!.slice("result-section-".length));
    return ids;
  };
  // Writes the remembered set without touching React state: the click
  // handler calls it in the click's own task (#40, run 38637072132: a reload
  // issued between the click and the later toggle task lost the state once
  // in ten runs). It must not set state, because React would commit the new
  // `open` before the browser's default action, which would then toggle the
  // element straight back.
  const remember = (id: string, isOpen: boolean) => {
    const next = seeded.current ? new Set(latest.current) : shown();
    seeded.current = true;
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
  return { open, known, toggle, remember };
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
  /** The remembered value, or undefined when nothing is remembered and the mount rule decides (D-2813). */
  open: boolean | undefined;
  onToggle: (id: string, open: boolean) => void;
  onRemember: (id: string, open: boolean) => void;
  children: ReactNode;
  nested?: boolean;
}) {
  // REQ-028 FR-13 (D-2274): the shared Disclosure, with the page's remembered
  // state passed through: the toggle sets it, the summary click records the
  // state the click produces in the click's own task (#40, run 38637072132).
  return (
    <SharedDisclosure
      open={open}
      openOnLarge={!nested}
      onToggle={(o) => onToggle(id, o)}
      onSummaryClick={(o) => onRemember(id, o)}
      className={nested ? "mt-2" : "rounded-md border"}
      summaryClassName={
        nested ? "min-h-11 px-3 py-2 text-base font-medium" : undefined
      }
      bodyClassName={nested ? "px-3 pb-3" : undefined}
      summary={summary}
      data-testid={`result-section-${id}`}
    >
      {children}
    </SharedDisclosure>
  );
}

/** REQ-027 D-2716, D-2718: a row step 5 did not ask about carries no tag, on both lists; a value the table lacks renders nothing too. */
const HAVE_VARIANT: Record<string, TagVariant> = {
  yes: "done",
  no: "need",
  "not-sure": "doing",
};

function HaveTag({ have }: { have: string }) {
  const t = HAVE_TAG[have as keyof typeof HAVE_TAG];
  if (!t) return null;
  return (
    <Tag variant={HAVE_VARIANT[have] ?? "neutral"} testId="have-tag">
      {t.label}
    </Tag>
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
  changes,
}: {
  subscriptionOffered: boolean;
  result: QuestionnaireResult;
  checklistTotal: number;
  signedIn: boolean;
  contactEmail: string | null;
  /** REQ-023 FR-11: how the result differs from the latest completed assessment, for a signed-in owner with a ready set. */
  changes?: ResultChanges;
}) {
  const r = result;
  const { open, known, toggle, remember } = useRememberedOpen();
  const { clearDraft } = useQuestionnaire();
  const router = useRouter();
  // The three sections: the remembered value when there is one, else the mount rule (D-2813).
  const sectionOpen = (id: string) => (known ? open.has(id) : undefined);
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
    <div
      className="min-h-screen lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-8"
      data-testid="result"
    >
      {/* REQ-028 FR-6: columns 1 to 5 sticky (the card, then the glossary directly under it, D-2701); 6 to 12 the sections. */}
      <div className="lg:sticky lg:top-24 lg:col-span-5 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
        {/* FR-4: the first screen is one card: the answer, one sentence, the counts, the line, one button. */}
        <section
          aria-labelledby="summary-heading"
          className="border-line bg-mist rounded-md border p-4"
          data-testid="summary"
        >
          <h2 id="summary-heading" className="">
            Your audit: {pathwayWord}
            {r.modifiedCertification ? " (modified scope)" : ""}
          </h2>
          {/* Batch 42 item 6 (D-549), REQ-025 FR-13: what the word means, from the glossary, in one line under the heading. */}
          <p className="text-ink mt-1 text-sm" data-testid="audit-kind">
            {glossarySentence(`${pathwayWord}-audit`)}
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={GROUPS_LABEL}>
            {r.groups.map((g) => (
              <li
                key={g.code}
                className="border-line text-ink rounded-full border px-2 py-0.5 text-sm"
              >
                {g.name} <span className="text-slate font-mono">{g.code}</span>
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
            <li className="tabular-nums" data-testid="summary-documents">
              {lines.documents}
            </li>
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
          {/* REQ-028 FR-6, D-2805 (D-2707 restored): one primary button whose label says where it goes, one text
            link with no figure; the checklist link lives in the documents section; the "Next:" line is gone. */}
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
                {signedIn ? "Go to your next step" : "Sign in to get ready"}
              </Link>
              <Link
                href="/pricing#start"
                className="inline-flex min-h-11 items-center underline underline-offset-4"
                data-testid="result-buy-link"
              >
                See the price
              </Link>
            </div>
          </div>
          {/* FR-6: "Change my answers" and "Start again" as small links in the card's footer (the phone exception that
            returns the row under the stepper to the fold; batch 48 item 2's confirm kept). */}
          <div
            className="mt-3 flex flex-wrap items-center gap-x-4 text-sm"
            data-testid="result-card-footer"
          >
            <Link
              href={stepHref("business")}
              className="inline-flex min-h-11 items-center underline underline-offset-4"
              data-testid="change-answers"
            >
              Change my answers
            </Link>
            <ConfirmButton
              label="Start again"
              question="Clear your answers and start again? Your result goes with them."
              confirmLabel="Yes, start again"
              className="inline-flex min-h-11 items-center underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
              // QA pass F7 (D-2269): the intro is the page "Start again" lands on; the provider's
              // `clearing` flag holds the result step's guard back while the answers empty.
              onConfirm={() => {
                void clearDraft();
                router.push("/start");
              }}
              testId="clear-draft"
            />
          </div>
          {/* REQ-023 FR-11 (D-2310, D-2341): prompts, not nags, after the card's controls. The groups changed is a
            variation to apply for and then record; a state added is conditional on where supports are delivered, with
            that state's own checks, and never says the duty has arisen. No row is written. */}
          {changes &&
          (changes.groupsChanged || changes.statesAdded.length > 0) ? (
            <div
              className="border-rule mt-4 rounded-md border p-4 text-sm leading-6"
              data-testid="result-changes"
            >
              {changes.groupsChanged ? (
                <p className="text-sm" data-testid="result-changes-groups">
                  Your registration groups changed since your last pack. This
                  changes your registration; you apply to vary it (NDIS Act s
                  73M), then{" "}
                  <Link
                    href="/registers/commission-changes/new?kind=variation&change_type=supports-registered"
                    className="underline underline-offset-4"
                    data-testid="result-changes-variation-link"
                  >
                    record it in your changes register
                  </Link>
                  .
                </p>
              ) : null}
              {changes.statesAdded.map((s) => (
                <div
                  key={s.state}
                  className="mt-2 first:mt-0"
                  data-testid={`result-changes-state-${s.state}`}
                >
                  <p className="text-sm">
                    If you now deliver supports in {s.name}, tell the Commission
                    (Rules s 13), and check {s.name}&apos;s own checks below.
                  </p>
                  <ul className="mt-1 list-disc pl-5">
                    {s.childrenCheck ? (
                      <li>Children&apos;s check: {s.childrenCheck}</li>
                    ) : null}
                    {s.restrictivePractice ? (
                      <li>Restrictive practices: {s.restrictivePractice}</li>
                    ) : null}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        {/* REQ-027 D-2701, D-2711: the one disclosure for the words on this page, under the card and inside no other
 disclosure, listing the terms present at render minus the audit kind the heading already explains. */}
        <GlossaryTerms ids={present} where="result" className="mt-2" />
      </div>

      <div className="mt-6 space-y-6 lg:col-span-7 lg:mt-0">
        {/* FR-5: three disclosures with counts in their summaries, closed under lg, open at lg on a first visit (D-2813). */}
        <Disclosure
          id="why"
          open={sectionOpen("why")}
          onToggle={toggle}
          onRemember={remember}
          summary={`Why this result (${r.reasons.length} reason${r.reasons.length === 1 ? "" : "s"}, with sources)`}
        >
          {r.flags.silExcluded ? (
            <p
              className="border-line bg-mist mt-2 rounded-md border p-4 text-sm leading-6"
              data-testid="sil-excluded"
            >
              {SIL_EXCLUDED_TEXT}
            </p>
          ) : null}
          {r.flags.restrictivePracticesAssumed ? (
            <p className="border-line bg-mist mt-2 rounded-md border p-4 text-sm leading-6">
              {RP_ASSUMED_TEXT}
            </p>
          ) : null}
          {r.flags.largeProvider ? (
            <p className="text-slate mt-2 text-sm leading-6">
              {BRAND} focuses on providers with up to about 10 workers. The
              standards below still apply to you.
            </p>
          ) : null}
          {/* REQ-025 FR-5: one list item per reason, the source as the link text; "opens in a new tab" said once. */}
          <p className="text-slate mt-2 text-sm" data-testid="reasons-intro">
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
          <h3 className="mt-5">
            {MODULES_HEADING} ({r.modules.length})
          </h3>
          <ul className="mt-2 space-y-3">
            {r.modules.map((m) => (
              <li
                key={m.id}
                className="border-rule rounded-md border p-4"
                data-testid={`module-${m.id}`}
              >
                <p className="text-base font-medium">
                  {m.name}{" "}
                  <span className="text-slate font-normal">
                    ({m.standardCount} standards)
                  </span>
                </p>
                <p className="text-ink mt-1 text-sm leading-6">
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
          <h3 className="mt-5">{MID_TERM_HEADING}</h3>
          <p className="mt-1 text-sm leading-6" data-testid="mid-term">
            {r.midTermAudit.applies
              ? MID_TERM_APPLIES.replace(
                  "about N months",
                  `about ${r.midTermAudit.monthsAfterRegistration} months`,
                ).replace(
                  "month N.",
                  `month ${r.midTermAudit.prepareFromMonth}.`,
                )
              : `${MID_TERM_NONE} ${r.midTermAudit.exemptReason ?? ""}`}
          </p>
        </Disclosure>

        <Disclosure
          id="documents"
          open={sectionOpen("documents")}
          onToggle={toggle}
          onRemember={remember}
          summary={`Documents you will need (${r.documents.length})`}
        >
          {/* REQ-028 FR-6, D-2805: the checklist link lives here, at the head of the documents it opens. */}
          <p className="mt-2 text-sm">
            <Link
              href={checklistHref}
              className="inline-flex min-h-11 items-center underline underline-offset-4"
              data-testid={signedIn ? "checklist-link" : "checklist-sign-in"}
            >
              Open these in your checklist
            </Link>
          </p>
          {/* REQ-025 FR-4a, REQ-027 D-2718 and D-2722: the pack's part and the reader's own answers, five sentences above the list, never per row. */}
          <p
            className="text-slate mt-2 text-sm leading-6"
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
                  <p className="text-ink mt-1">
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
                className="divide-rule divide-y"
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
          open={sectionOpen("registers")}
          onToggle={toggle}
          onRemember={remember}
          summary={`Registers to keep (${r.registers.length})`}
        >
          <p
            className="text-slate mt-2 text-sm leading-6"
            data-testid="registers-legend"
          >
            {REGISTERS_LEGEND}
          </p>
          <ul className="divide-rule mt-2 divide-y">
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
          className="border-rule grid gap-2 rounded-md border p-4 text-sm sm:grid-cols-2"
          data-testid="result-two-halves"
        >
          <div>
            <dt className="font-semibold">What keeps you audit-ready</dt>
            {subscriptionOffered ? (
              <dd className="text-ink">
                The registers and reminders, a monthly subscription that keeps
                your evidence in one place for renewal.{" "}
                <Link
                  href="/pricing#keeps"
                  className="underline underline-offset-2"
                >
                  The subscription
                </Link>
                .
              </dd>
            ) : (
              <dd className="text-ink" data-testid="result-subscription-off">
                The registers and reminders, with the evidence already in place
                at renewal. {SUBSCRIPTION_OFF}
              </dd>
            )}
          </div>
          <div>
            <dt className="font-semibold">Where you start</dt>
            <dd className="text-ink">
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
          className="border-rule rounded-md border p-4"
          data-testid="what-next"
        >
          <h2 id="next-heading" className="">
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

        {/* REQ-028 FR-6: one line; the footer keeps the full statement. */}
        <p className="text-slate text-sm leading-6" data-testid="result-notice">
          General information, not legal advice.{" "}
          <Link href="/terms" className="underline underline-offset-2">
            Read the terms
          </Link>
          .
        </p>

        {/* REQ-013 FR-9, REQ-015 FR-6: one line, the address as a link. */}
        <p className="text-ink text-sm leading-6" data-testid="result-contact">
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
    </div>
  );
}
