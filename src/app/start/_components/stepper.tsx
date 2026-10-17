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
 * One stepper on every questionnaire page (REQ-025 FR-6 to FR-8; D-2217):
 * line one, "Step 5 of 6: Already have", is the primary indicator and is
 * always visible; beneath it a row of six numbered circles joined by a
 * line that fills in ochre up to the current step, with the labels under
 * the circles from 640 px up. A done step is a plain link back to it; the
 * current step carries aria-current="step"; a step not yet reached is
 * muted and not interactive. On a phone the circles carry no labels and a
 * "Show steps" disclosure beside line one lists the step names with the
 * same links, so nothing nests an interaction inside the row. No
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

const circle =
  "flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2";

export function Stepper({
  step,
  answers,
  ready,
  className,
  lineClassName,
  circlesClassName,
}: {
  step: StepId;
  answers: QuestionnaireDraft["answers"];
  ready: boolean;
  /** REQ-028 FR-5: the shell's header grid places the nav, line one and the circles from lg. */
  className?: string;
  lineClassName?: string;
  circlesClassName?: string;
}) {
  const index = stepIndex(step);
  const states = stepStates(step, answers, ready);
  const total = STEP_IDS.length;
  return (
    <nav
      aria-label="Questionnaire steps"
      data-testid="stepper"
      className={className}
    >
      {/* FR-6: line one is the indicator everyone reads; FR-8: the names on a phone sit behind one control beside it. */}
      {/* The row is the list's containing block: the open list spans the row's
          width, so it never hangs off the screen when the control wraps onto
          its own line at a large text size (the iphone project at 130 %, run
          38766171500; anchored to the control's right edge it sat 173 px off
          the left edge). */}
      <div
        className={[
          "relative flex flex-wrap items-center justify-between gap-x-4 gap-y-1",
          lineClassName ?? null,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <p
          className="text-slate text-sm font-medium"
          data-testid="progress-line-label"
        >
          Step {index + 1} of {total}: {STEP_SHORT[step]}
        </p>
        <details className="sm:hidden" data-testid="stepper-steps">
          <summary className="border-line bg-surface inline-flex min-h-11 cursor-pointer list-none items-center rounded-md border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
            Show steps
          </summary>
          <ol
            className="border-rule bg-surface absolute inset-x-0 z-10 mt-1 rounded-md border p-2 text-sm shadow-sm"
            data-testid="stepper-steps-list"
          >
            {STEP_IDS.map((id, i) => {
              const state = states[i];
              const text = `${i + 1}. ${STEP_SHORT[id]}`;
              return (
                <li key={id} data-state={state}>
                  {state === "done" ? (
                    <Link
                      href={stepHref(id)}
                      className="inline-flex min-h-11 items-center underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {text}
                      <span className="sr-only">: done, change it</span>
                    </Link>
                  ) : state === "current" ? (
                    // One current step per navigation: the circle below carries
                    // aria-current; this item says "current" in words.
                    <span className="inline-flex min-h-11 items-center font-semibold">
                      {text}
                      <span className="sr-only">: current</span>
                    </span>
                  ) : (
                    <span className="text-slate inline-flex min-h-11 items-center">
                      {text}
                      <span className="sr-only">: not yet</span>
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </details>
      </div>
      <ol
        className={["mt-2 flex items-start", circlesClassName ?? null]
          .filter(Boolean)
          .join(" ")}
      >
        {STEP_IDS.map((id, i) => {
          const state = states[i];
          const n = i + 1;
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
                  className={`${circle} bg-ochre text-paper relative`}
                  aria-label={`Step ${n}, ${STEP_SHORT[id]}: done, change it`}
                >
                  <span aria-hidden="true">✓</span>
                </Link>
              ) : state === "current" ? (
                <span
                  aria-current="step"
                  className={`${circle} text-ink ring-ochre bg-paper relative ring-2`}
                >
                  <span aria-hidden="true">{n}</span>
                  <span className="sr-only">
                    Step {n}, {STEP_SHORT[id]}: current
                  </span>
                </span>
              ) : (
                <span
                  aria-disabled="true"
                  className={`${circle} text-slate bg-mist relative`}
                >
                  <span aria-hidden="true">{n}</span>
                  <span className="sr-only">
                    Step {n}, {STEP_SHORT[id]}: not yet
                  </span>
                </span>
              )}
              {/* FR-6: labels under the circles from 640 px up; FR-8: on a phone the names are in the disclosure above. */}
              <span
                aria-hidden="true"
                className={`mt-1 hidden text-sm sm:block ${state === "current" ? "font-semibold" : state === "todo" ? "text-slate" : ""}`}
              >
                {STEP_SHORT[id]}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
