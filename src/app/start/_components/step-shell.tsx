"use client";
import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { ProgressLine } from "@/components/progress-line";
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
  // REQ-013 FR-7: completed earlier steps stay one tap away; nothing wraps.
  const completed = STEP_IDS.filter(
    (id, i) => i < index && ready && canOpenStep(id, answers),
  );

  // AC-11: focus moves to the step heading on every step change.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <ProgressLine
        current={index + 1}
        total={STEP_IDS.length}
        label={`Step ${index + 1} of ${STEP_IDS.length}: ${STEP_SHORT[step]}`}
      />
      {completed.length > 0 ? (
        <nav aria-label="Completed steps" className="mt-2 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Back to: </span>
          <ul className="inline">
            {completed.map((id, i) => (
              <li key={id} className="inline">
                {i > 0 ? <span aria-hidden="true">, </span> : null}
                <Link
                  href={stepHref(id)}
                  className="inline-flex min-h-11 items-center underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {STEP_SHORT[id]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-4 text-2xl font-semibold tracking-tight outline-none sm:text-3xl"
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
