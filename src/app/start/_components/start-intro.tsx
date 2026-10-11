"use client";
import Link from "next/link";
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
  const { ready, answers, saveStatus, clearDraft } = useQuestionnaire();
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
      <p className="mt-6 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        Nothing you type is sent anywhere until the last step, and nothing is
        stored on our servers in this version. Your answers are kept as a draft
        on this device so you can come back later. Do not enter any
        participant&apos;s details.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        {ready && hasDraft ? (
          <>
            <Link
              href={resume}
              className="inline-flex min-h-12 items-center justify-center rounded-md bg-zinc-900 px-5 text-base font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Continue where you left off
            </Link>
            <button
              type="button"
              onClick={() => void clearDraft()}
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-zinc-300 px-5 text-base font-medium hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Start again and clear the draft
            </button>
          </>
        ) : (
          <Link
            href={stepHref("business")}
            className="inline-flex min-h-12 items-center justify-center rounded-md bg-zinc-900 px-5 text-base font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
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
