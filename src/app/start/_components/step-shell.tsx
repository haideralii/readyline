"use client";
import { PageShell } from "@/components/page-shell";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { STEP_TITLES } from "@/lib/questionnaire/navigation";
import type { StepId } from "@/lib/questionnaire/steps";
import { useQuestionnaire } from "./questionnaire-provider";
import { Stepper } from "./stepper";

export function StepShell({
  step,
  children,
}: {
  step: StepId;
  children: ReactNode;
}) {
  const { answers, saveStatus, ready, mode, clearDraft } = useQuestionnaire();
  const router = useRouter();
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
    <PageShell kind="form" padding="compact">
      {/* Batch 48 item 2: one stepper on every step; a done step is the way back to it. */}
      <Stepper step={step} answers={answers} ready={ready} />
      {step === "result" ? (
        // Batch 48 item 2: "Start again" clears the draft after a one-screen confirm (REQ-015 FR-15);
        // changing one answer is tapping that step above.
        <div className="text-sm">
          <ConfirmButton
            label="Start again"
            question="Clear your answers and start again? Your result goes with them."
            confirmLabel="Yes, start again"
            className="inline-flex min-h-11 items-center underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
            // QA pass F7 (D-2269): the intro is the page "Start again" lands on; the
            // provider's `clearing` flag holds the result step's guard back while the
            // answers empty, so this push is the one navigation.
            onConfirm={() => {
              void clearDraft();
              router.push("/start");
            }}
            testId="clear-draft"
          />
        </div>
      ) : null}

      <h1
        ref={headingRef}
        tabIndex={-1}
        className="focus-quiet mt-4 text-2xl font-semibold tracking-tight outline-none sm:text-3xl"
      >
        {STEP_TITLES[step]}
      </h1>

      <div className="mt-6">{children}</div>

      <p
        className="text-slate mt-8 text-xs"
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
