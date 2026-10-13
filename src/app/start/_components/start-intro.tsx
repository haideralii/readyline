"use client";
import Link from "next/link";
import { ConfirmButton } from "@/components/confirm-button";
import { firstIncompleteStep, stepHref } from "@/lib/questionnaire/navigation";
import { useQuestionnaire } from "./questionnaire-provider";

const STEPS = [
  "About your business: trading name, structure, states, ABN (optional).",
  "The supports you deliver: choose your registration groups.",
  "Restrictive practices: whether you use or plan to use them.",
  "Your workforce: how many workers and whether they are screened.",
  "What you already have: policies, registers and insurance.",
];

export function StartIntro() {
  const { ready, answers, saveStatus, clearDraft, mode } = useQuestionnaire();
  const hasDraft = Object.keys(answers).length > 0;
  const resume = stepHref(firstIncompleteStep(answers));

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
        About ten minutes, five steps
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
        Find out what registration needs from you
      </h1>
      <p className="mt-4 text-lg leading-8 text-zinc-700 dark:text-zinc-300">
        Answer a few questions about your business and the supports you deliver.
        You will see which Practice Standards modules apply, whether you face a
        verification or certification audit, and the documents and registers you
        will need, with the Commission source for each decision.
      </p>
      <ol className="mt-6 list-decimal space-y-2 pl-5 leading-7 text-zinc-700 dark:text-zinc-300">
        {STEPS.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {/* Batch 23 item 3: the storage sentence must match where the draft actually lives. */}
      <p
        className="mt-6 text-sm leading-6 text-zinc-600 dark:text-zinc-400"
        data-testid="start-storage-note"
      >
        {mode === "server"
          ? "You are signed in. Your answers are saved to your account after each step, so you can continue from any device. Step 1 starts with your account's business details. Do not enter any participant's details."
          : "Your answers stay on this device as a draft until the last step. Sign in to keep them with your account instead. Do not enter any participant's details."}
      </p>

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
    </div>
  );
}
