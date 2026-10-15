"use client";
import Link from "next/link";
import {
  STEP_SHORT,
  canOpenStep,
  stepHref,
  stepIndex,
} from "@/lib/questionnaire/navigation";
import { STEP_IDS, type StepId } from "@/lib/questionnaire/steps";
import type { QuestionnaireDraft } from "@/lib/questionnaire/schema";

/**
 * One stepper on every questionnaire page (batch 48 item 2): six numbered
 * circles in a row with the label beneath, joined by a line that fills in
 * ochre up to the current step. A done step is a link back to it; the
 * current step carries aria-current="step"; a step not yet reached is
 * muted and not interactive. At 360 px the circles stay in one row without
 * labels and the line beneath says "Step 5 of 6: Already have". No
 * animation, CSS only, tap targets of 44 px, the REQ-015 focus ring.
 */
export type StepState = "done" | "current" | "todo";

export function stepStates(
  step: StepId,
  answers: QuestionnaireDraft["answers"],
  ready: boolean,
): StepState[] {
  const index = stepIndex(step);
  return STEP_IDS.map((id, i) =>
    i === index
      ? "current"
      : i < index && ready && canOpenStep(id, answers)
        ? "done"
        : "todo",
  );
}

export function Stepper({
  step,
  answers,
  ready,
}: {
  step: StepId;
  answers: QuestionnaireDraft["answers"];
  ready: boolean;
}) {
  const index = stepIndex(step);
  const states = stepStates(step, answers, ready);
  const total = STEP_IDS.length;
  return (
    <nav aria-label="Questionnaire steps" data-testid="stepper">
      <ol className="flex items-start">
        {STEP_IDS.map((id, i) => {
          const state = states[i];
          const n = i + 1;
          const circle =
            "flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2";
          return (
            <li
              key={id}
              className="relative flex min-w-0 flex-1 flex-col items-center text-center"
              data-testid={`stepper-${id}`}
              data-state={state}
            >
              {i > 0 ? (
                <span
                  aria-hidden="true"
                  className={`absolute top-[21px] right-1/2 left-0 h-0.5 ${i <= index ? "bg-ochre" : "bg-mist"}`}
                />
              ) : null}
              {i < total - 1 ? (
                <span
                  aria-hidden="true"
                  className={`absolute top-[21px] right-0 left-1/2 h-0.5 ${i < index ? "bg-ochre" : "bg-mist"}`}
                />
              ) : null}
              {state === "done" ? (
                <Link
                  href={stepHref(id)}
                  className={`${circle} bg-ochre relative text-white`}
                  aria-label={`Step ${n}, ${STEP_SHORT[id]}: done, change it`}
                >
                  <span aria-hidden="true">✓</span>
                </Link>
              ) : state === "current" ? (
                <span
                  aria-current="step"
                  className={`${circle} text-ink ring-ochre relative bg-white ring-2 dark:bg-zinc-900 dark:text-white`}
                  aria-label={`Step ${n}, ${STEP_SHORT[id]}: current`}
                >
                  {n}
                </span>
              ) : (
                <span
                  aria-disabled="true"
                  className={`${circle} text-slate bg-mist relative`}
                  aria-label={`Step ${n}, ${STEP_SHORT[id]}: not yet`}
                >
                  {n}
                </span>
              )}
              <span
                aria-hidden="true"
                className={`mt-1 hidden text-xs sm:block ${state === "current" ? "font-semibold" : state === "todo" ? "text-slate" : ""}`}
              >
                {STEP_SHORT[id]}
              </span>
            </li>
          );
        })}
      </ol>
      <p
        className="text-slate mt-2 text-sm font-medium"
        data-testid="progress-line-label"
      >
        Step {index + 1} of {total}: {STEP_SHORT[step]}
      </p>
    </nav>
  );
}
