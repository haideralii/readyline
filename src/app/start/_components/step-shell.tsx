"use client";
import { PageShell } from "@/components/page-shell";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { STEP_TITLES } from "@/lib/questionnaire/navigation";
import type { StepId } from "@/lib/questionnaire/steps";
import { useQuestionnaire } from "./questionnaire-provider";
import { Stepper } from "./stepper";

/**
 * The questionnaire's page (REQ-028 FR-5, D-2276): under `lg` the stepper,
 * the heading and the step as they were; from `lg` a header grid where line
 * one ("Step N of 6") sits at the right of the h1 and the circles under it
 * across the form's columns, through the stepper's subgrid, with the DOM
 * order unchanged (the stepper first, then the heading). The step's form
 * is its own grid beneath (`.step-form`, D-2276).
 */
export function StepShell({
  step,
  children,
}: {
  step: StepId;
  children: ReactNode;
}) {
  const { answers, saveStatus, ready, mode } = useQuestionnaire();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // AC-11: focus moves to the step heading on every step change, and on a
  // first load only once the draft has loaded and the form is live (batch
  // 45b item 4): a heading focused while the form was still disabled told a
  // keyboard user the step was ready when a Tab would have skipped every
  // field and landed in the footer. A layout effect, so the focus lands in
  // the same task that enables the form (a passive effect left a window
  // after paint in which text typed into a field went to the heading), and
  // never from a text control someone has already reached.
  useLayoutEffect(() => {
    if (!ready) return;
    const active = document.activeElement;
    if (
      active instanceof HTMLElement &&
      ["INPUT", "SELECT", "TEXTAREA"].includes(active.tagName)
    )
      return;
    headingRef.current?.focus();
  }, [step, ready]);

  // Phone top padding is 24 px and the "Start again" row carries no margin of
  // its own (the link's 44 px height is the gap): the result card's one button
  // has to end inside a 681 px iPhone screen (REQ-015 FR-4), and the stepper's
  // second row had pushed it 13 px past it (run 38772962718).
  return (
    <PageShell kind="grid" padding="compact">
      <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-baseline lg:gap-x-6">
        {/* Batch 48 item 2: one stepper on every step; a done step is the way back to it. */}
        <Stepper
          step={step}
          answers={answers}
          ready={ready}
          className="order-1 lg:order-none lg:col-span-2 lg:row-span-2 lg:grid lg:grid-cols-subgrid lg:grid-rows-subgrid"
          lineClassName="lg:col-start-2 lg:row-start-1 lg:justify-self-end"
          circlesClassName="lg:col-span-2 lg:row-start-2 lg:mt-4 lg:w-[calc(58.333%-1rem)]"
          // REQ-028 FR-6 (AC-4's phone exception): on the result the stepper is line one alone under sm.
          collapseUnderSm={step === "result"}
        />

        <h1
          ref={headingRef}
          tabIndex={-1}
          className="focus-quiet order-3 mt-4 outline-none lg:order-none lg:col-start-1 lg:row-start-1 lg:mt-0"
        >
          {STEP_TITLES[step]}
        </h1>
      </div>

      <div className="mt-6">{children}</div>

      <p
        className="text-slate mt-8 text-sm lg:w-[calc(58.333%-1rem)]"
        role="status"
        data-testid="draft-status"
      >
        {mode === "server"
          ? saveStatus === "saved"
            ? "Draft saved to your account."
            : saveStatus === "unavailable"
              ? "Could not save to your account just now; your answers stay in this tab."
              : "Your draft is saved to your account after each step."
          : saveStatus === "saved"
            ? "Draft saved locally on this device."
            : saveStatus === "unavailable"
              ? "Could not save a draft on this device; your answers stay in this tab."
              : "Your draft will be saved locally on this device after each step."}
      </p>
    </PageShell>
  );
}
