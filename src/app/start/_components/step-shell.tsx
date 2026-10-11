"use client";
import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import {
  STEP_SHORT,
  STEP_TITLES,
  canOpenStep,
  stepHref,
  stepIndex,
} from "@/lib/questionnaire/navigation";
import { STEP_IDS, type StepId } from "@/lib/questionnaire/schema";
import { useQuestionnaire } from "./questionnaire-provider";

export function StepShell({
  step,
  children,
}: {
  step: StepId;
  children: ReactNode;
}) {
  const { answers, saveStatus, ready } = useQuestionnaire();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const index = stepIndex(step);

  // AC-11: focus moves to the step heading on every step change.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <nav aria-label="Questionnaire steps" className="mb-6">
        <ol className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {STEP_IDS.map((id, i) => {
            const open = ready && canOpenStep(id, answers);
            const current = id === step;
            const label = `${i + 1}. ${STEP_SHORT[id]}`;
            return (
              <li key={id} className="flex items-center">
                {open && !current ? (
                  <Link
                    href={stepHref(id)}
                    className="inline-flex min-h-11 items-center rounded px-1 text-zinc-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-zinc-300"
                  >
                    {label}
                  </Link>
                ) : (
                  <span
                    aria-current={current ? "step" : undefined}
                    className={
                      current
                        ? "inline-flex min-h-11 items-center rounded px-1 font-semibold text-zinc-900 dark:text-zinc-50"
                        : "inline-flex min-h-11 items-center rounded px-1 text-zinc-400 dark:text-zinc-500"
                    }
                  >
                    {label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
        Step {index + 1} of {STEP_IDS.length}
      </p>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-1 text-2xl font-semibold tracking-tight outline-none sm:text-3xl"
      >
        {STEP_TITLES[step]}
      </h1>

      <div className="mt-6">{children}</div>

      <p
        className="mt-8 text-xs text-zinc-500 dark:text-zinc-400"
        role="status"
        data-testid="draft-status"
      >
        {saveStatus === "saved"
          ? "Draft saved locally on this device."
          : saveStatus === "unavailable"
            ? "Could not save a draft on this device; your answers stay in this tab."
            : "Your draft will be saved locally on this device after each step."}
      </p>
    </div>
  );
}
