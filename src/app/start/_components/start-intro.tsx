"use client";
import { PageShell } from "@/components/page-shell";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { GlossaryTerms } from "@/components/glossary-terms";
import { firstIncompleteStep, stepHref } from "@/lib/questionnaire/navigation";
import { useQuestionnaire } from "./questionnaire-provider";

/**
 * REQ-011 batch 31: a group page's CTA arrives as `/start?group=<code>`. The
 * code is kept for the supports step in session storage (this tab only) so
 * the group is ticked when the provider gets there. Read through an
 * external-store subscription so the server and the first client render
 * agree (nothing on the server), as the supports step does for the viewport.
 */
export const PRESELECT_KEY = "readyline.start.group";

function subscribeNothing() {
  return () => {};
}

function readPreselect(): string | null {
  try {
    const code = new URLSearchParams(window.location.search).get("group");
    if (code && /^\d{4}$/.test(code)) {
      window.sessionStorage.setItem(PRESELECT_KEY, code);
      return code;
    }
    return window.sessionStorage.getItem(PRESELECT_KEY);
  } catch {
    return null;
  }
}

/** REQ-027 FR-3 (D-2710): the glossary terms this page's words use, first appearance first. */
const INTRO_TERMS = [
  "practice-standards",
  "module",
  "certification-audit",
  "registration-group",
  "restrictive-practice",
] as const;

const STEPS = [
  "About your business: trading name, structure, states, ABN (optional).",
  "The supports you deliver: choose your registration groups.",
  "Restrictive practices: whether you use or plan to use them.",
  "Your workforce: how many workers and whether they are screened.",
  "What you already have: policies, registers and insurance.",
];

export function StartIntro() {
  const { ready, answers, saveStatus, clearDraft, mode, groups } =
    useQuestionnaire();
  const hasDraft = Object.keys(answers).length > 0;
  const resume = stepHref(firstIncompleteStep(answers));
  const preselectCode = useSyncExternalStore(
    subscribeNothing,
    readPreselect,
    () => null,
  );
  const preselect = groups.find((g) => g.code === preselectCode) ?? null;

  return (
    <PageShell kind="reading">
      <p className="text-slate text-sm font-medium">
        About ten minutes, five steps
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
        Find out what registration needs from you
      </h1>
      <p className="text-ink mt-4 text-lg leading-8">
        Answer a few questions about your business and the supports you deliver.
        You will see which Practice Standards modules apply, whether you face a
        verification or certification audit, and the documents and registers you
        will need, with the Commission source for each decision.
      </p>
      {/* REQ-027 FR-3, D-2701: the words on this page, above the steps and inside no other disclosure. */}
      <GlossaryTerms ids={INTRO_TERMS} where="page" className="mt-3" />
      <ol className="text-ink mt-6 list-decimal space-y-2 pl-5 leading-7">
        {STEPS.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {/* Batch 23 item 3: the storage sentence must match where the draft actually lives. */}
      <p
        className="text-slate mt-6 text-sm leading-6"
        data-testid="start-storage-note"
      >
        {mode === "server"
          ? "You are signed in. Your answers are saved to your account after each step, so you can continue from any device. Step 1 starts with your account's business details. Do not enter any participant's details."
          : "Your answers stay on this device as a draft until the last step. Sign in to keep them with your account instead. Do not enter any participant's details."}
      </p>

      {preselect && !hasDraft ? (
        <p
          className="text-ink mt-3 text-sm leading-6"
          data-testid="start-preselect"
        >
          We will tick {preselect.name.toLowerCase()} (class {preselect.code})
          for you in step 2. Add anything else you deliver there.
        </p>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        {ready && hasDraft ? (
          <>
            <Link href={resume} className="btn-primary">
              Continue where you left off
            </Link>
            <ConfirmButton
              label="Start again and clear the draft"
              question="Clear your saved answers and start again?"
              confirmLabel="Yes, clear them"
              onConfirm={() => void clearDraft()}
              testId="clear-draft"
            />
          </>
        ) : (
          <Link href={stepHref("business")} className="btn-primary">
            Start the questionnaire
          </Link>
        )}
      </div>
      {saveStatus === "unavailable" ? (
        <p
          className="mt-4 text-sm text-amber-800 dark:text-amber-300"
          role="status"
        >
          Drafts cannot be saved on this device (private window or storage
          blocked). You can still complete the questionnaire in one sitting.
        </p>
      ) : null}
    </PageShell>
  );
}
