"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BRAND } from "@/lib/brand";
import { ConfirmButton } from "@/components/confirm-button";
import { ReadyLine } from "@/components/ready-line";
import {
  readinessCounts,
  readinessSentence,
  readyLineCounts,
} from "@/lib/questionnaire/readiness";
import {
  documentGroupId,
  documentGroupsContent,
} from "@/lib/questionnaire/content";
import { stepHref } from "@/lib/questionnaire/navigation";
import { ANSWERS_VERSION } from "@/lib/questionnaire/schema";
import type { QuestionnaireResult } from "@/lib/questionnaire/result";
import { deriveResult, type DeriveResultResponse } from "../../actions";
import { useQuestionnaire } from "../questionnaire-provider";

/**
 * The result page (REQ-015 Section B): the answer first, in one card that
 * fits a phone screen, with one primary button; everything else folded into
 * three disclosures whose state is remembered on this device (FR-4 to FR-7).
 * The earlier REQ-013 and REQ-014 test ids are kept.
 */

/** "You said" as a small tag with an icon, never a second line (FR-5). */
const HAVE_TAG: Record<string, { label: string; icon: string; tone: string }> =
  {
    // REQ-013 batch 36 item 3: the customer's words; "not asked about yet" is never shown.
    yes: { label: "You have this", icon: "✓", tone: "text-moss border-moss" },
    no: {
      label: "You said you don't have this yet",
      icon: "○",
      tone: "text-ochre border-ochre",
    },
    "not-sure": {
      label: "You said: not sure",
      icon: "?",
      tone: "text-slate border-slate",
    },
    unknown: {
      label: `${BRAND} drafts this`,
      icon: "○",
      tone: "text-slate border-slate",
    },
  };

type Fetch = {
  key: string;
  response: DeriveResultResponse | null;
  failed: boolean;
};

export function ResultStep() {
  const { answers, clearDraft, mode, contactEmail } = useQuestionnaire();
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
      result={response.result}
      checklistTotal={response.checklistTotal}
      signedIn={mode === "server"}
      contactEmail={contactEmail}
      onStartAgain={() => void clearDraft()}
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
  const toggle = (id: string, isOpen: boolean) => {
    const next = new Set(latest.current);
    if (isOpen) next.add(id);
    else next.delete(id);
    latest.current = next;
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify([...next]));
    } catch {
      // Storage can be blocked; the page still works.
    }
    setOpen(next);
  };
  return { open, toggle };
}

function Disclosure({
  id,
  summary,
  open,
  onToggle,
  children,
  nested = false,
}: {
  id: string;
  summary: ReactNode;
  open: boolean;
  onToggle: (id: string, open: boolean) => void;
  children: ReactNode;
  nested?: boolean;
}) {
  return (
    <details
      open={open}
      onToggle={(e) => onToggle(id, e.currentTarget.open)}
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

function HaveTag({ have }: { have: string }) {
  const t = HAVE_TAG[have] ?? HAVE_TAG.unknown;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${t.tone}`}
    >
      <span aria-hidden="true">{t.icon}</span>
      {t.label}
    </span>
  );
}

function haveCounts(items: readonly { have: string }[]) {
  const c = { yes: 0, toPrepare: 0, notSure: 0 };
  for (const i of items) {
    if (i.have === "yes") c.yes += 1;
    else if (i.have === "not-sure") c.notSure += 1;
    else c.toPrepare += 1;
  }
  const parts: string[] = [];
  if (c.yes) parts.push(`${c.yes} you have`);
  if (c.toPrepare) parts.push(`${c.toPrepare} ${BRAND} drafts`);
  if (c.notSure) parts.push(`${c.notSure} not sure`);
  return parts.join(", ");
}

function ResultView({
  result,
  checklistTotal,
  signedIn,
  contactEmail,
  onStartAgain,
}: {
  result: QuestionnaireResult;
  checklistTotal: number;
  signedIn: boolean;
  contactEmail: string | null;
  onStartAgain: () => void;
}) {
  const r = result;
  const router = useRouter();
  const { open, toggle } = useRememberedOpen();
  const pathwayWord =
    r.pathway === "verification" ? "verification" : "certification";
  const groups = documentGroupsContent.groups
    .map((g) => ({
      ...g,
      items: r.documents.filter((d) => documentGroupId(d.id) === g.id),
    }))
    .filter((g) => g.items.length > 0);
  const checklistHref = signedIn ? "/checklist" : "/sign-in?next=%2Fchecklist";

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
        {/* Batch 42 item 6 (D-549): what the word means, in one line under the heading. */}
        <p
          className="mt-1 text-sm text-zinc-700 dark:text-zinc-300"
          data-testid="audit-kind"
        >
          {r.pathway === "verification"
            ? "That is a desk check of your documents."
            : "That is a visit, with interviews."}
        </p>
        <ul
          className="mt-2 flex flex-wrap gap-1.5"
          aria-label="Registration groups in scope"
        >
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
        {/* Batch 42 item 5 added the audit-kind line; the phone spacing below is
            16 px tighter than the wider layout so the one button still ends
            inside the first screen on a 681 px iPhone (REQ-015 FR-4). */}
        <p
          className="mt-2 text-base leading-7 sm:mt-3"
          data-testid="pathway-description"
        >
          {r.pathway === "verification"
            ? "An auditor reads your documents at their desk. Nobody visits."
            : "An auditor visits you, talks to your workers and some participants, and reads your documents."}
        </p>
        <p className="mt-1 text-base leading-7 sm:mt-2">
          You will need <strong>{r.documents.length} documents</strong> and{" "}
          <strong>{r.registers.length} registers</strong>.
        </p>
        {/* REQ-013 batch 36 item 3: two segments (have / still to do) and one sentence in the customer's words. */}
        <div className="mt-2 sm:mt-3">
          <ReadyLine
            counts={readyLineCounts(readinessCounts(r))}
            sentence={readinessSentence(readinessCounts(r))}
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
              href="/pricing"
              className="inline-flex min-h-11 items-center underline underline-offset-4"
              data-testid="result-buy-link"
            >
              See the price
            </Link>
          </div>
        </div>
      </section>

      {/* FR-5: three closed disclosures with counts in their summaries. */}
      <Disclosure
        id="why"
        open={open.has("why")}
        onToggle={toggle}
        summary={`Why this result (${r.reasons.length} reason${r.reasons.length === 1 ? "" : "s"}, with sources)`}
      >
        {r.flags.silExcluded ? (
          <p
            className="mt-2 rounded-md border border-zinc-300 bg-zinc-50 p-3 text-sm leading-6 dark:border-zinc-700 dark:bg-zinc-900"
            data-testid="sil-excluded"
          >
            The service you described is not supported independent living under
            the Commission&apos;s definition. Class 0138 and the SIL module are
            not in your result.
          </p>
        ) : null}
        {r.flags.restrictivePracticesAssumed ? (
          <p className="mt-2 rounded-md border border-zinc-300 bg-zinc-50 p-3 text-sm leading-6 dark:border-zinc-700 dark:bg-zinc-900">
            You were not sure about restrictive practices, and at least one of
            your answers to the three helper questions pointed to yes, so we
            included the implementing behaviour support plans module. Change the
            answer on the restrictive practices step and the module drops out.
          </p>
        ) : null}
        {r.flags.largeProvider ? (
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {BRAND} focuses on providers with up to about 10 workers. The
            standards below still apply to you.
          </p>
        ) : null}
        <ul className="mt-3 space-y-3">
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
                Source: {x.source.title} (opens in a new tab)
              </a>
            </li>
          ))}
        </ul>
        <h3 className="mt-5 text-base font-semibold">
          Practice Standards modules that apply ({r.modules.length})
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
                  The standards in this module
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
        <h3 className="mt-5 text-base font-semibold">Mid-term audit</h3>
        <p className="mt-1 text-sm leading-6" data-testid="mid-term">
          {r.midTermAudit.applies
            ? `Applies: about ${r.midTermAudit.monthsAfterRegistration} months after registration, against the provider governance and operational management standards. Start preparing from month ${r.midTermAudit.prepareFromMonth}.`
            : `Does not apply. ${r.midTermAudit.exemptReason ?? ""}`}
        </p>
      </Disclosure>

      <Disclosure
        id="documents"
        open={open.has("documents")}
        onToggle={toggle}
        summary={`Documents you will need (${r.documents.length})`}
      >
        <p
          className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400"
          data-testid="have-legend"
        >
          Tags come from your answers in the last step. &ldquo;{BRAND} drafts
          this&rdquo; means it is in your pack.
        </p>
        {groups.map((g) => (
          <Disclosure
            key={g.id}
            id={`doc-group-${g.id}`}
            nested
            open={open.has(`doc-group-${g.id}`)}
            onToggle={toggle}
            summary={
              <>
                {g.title} ({g.items.length}
                {haveCounts(g.items) ? `: ${haveCounts(g.items)}` : ""})
              </>
            }
          >
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
        summary={`Registers to keep (${r.registers.length})`}
      >
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Kept after registration; an auditor samples them at the mid-term audit
          and at renewal.
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

      <section
        aria-labelledby="next-heading"
        className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
        data-testid="what-next"
      >
        <h2 id="next-heading" className="text-lg font-semibold">
          What happens next
        </h2>
        <p className="mt-2 text-sm leading-6">
          {BRAND} drafts these documents as a one-off pack; the registers follow
          as a subscription.{" "}
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

      <div className="flex flex-col gap-3 sm:flex-row">
        <ConfirmButton
          label="Clear the draft on this device"
          question="Clear your answers on this device? Your result goes with them."
          confirmLabel="Yes, clear them"
          onConfirm={() => {
            onStartAgain();
            router.push("/start");
          }}
          testId="clear-draft"
        />
      </div>
    </div>
  );
}
