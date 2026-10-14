"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  canOpenStep,
  firstIncompleteStep,
  nextStep,
  stepHref,
} from "@/lib/questionnaire/navigation";
import type { StepId } from "@/lib/questionnaire/steps";
import { useQuestionnaire } from "./questionnaire-provider";
import { StepShell } from "./step-shell";

/** While a step's own chunk arrives on a client-side move between steps; a step's height, so nothing jumps. */
function StepLoading() {
  return (
    <p className="min-h-[70vh] text-zinc-600 dark:text-zinc-400" role="status">
      Loading…
    </p>
  );
}

// Backlog 2 (D-1012): one chunk per step, rendered on the server as before,
// so a step page carries its own form and not the other four (the result,
// which also carries the content tables, only when it is the step). The
// options are written out each time: next/dynamic reads them at build time.
const BusinessStepForm = dynamic(
  () => import("./steps/business-step").then((m) => m.BusinessStepForm),
  { loading: StepLoading },
);
const SupportsStepForm = dynamic(
  () => import("./steps/supports-step").then((m) => m.SupportsStepForm),
  { loading: StepLoading },
);
const PracticesStepForm = dynamic(
  () => import("./steps/practices-step").then((m) => m.PracticesStepForm),
  { loading: StepLoading },
);
const WorkforceStepForm = dynamic(
  () => import("./steps/workforce-step").then((m) => m.WorkforceStepForm),
  { loading: StepLoading },
);
const ExistingStepForm = dynamic(
  () => import("./steps/existing-step").then((m) => m.ExistingStepForm),
  { loading: StepLoading },
);
const ResultStep = dynamic(
  () => import("./steps/result-step").then((m) => m.ResultStep),
  { loading: StepLoading },
);

/** The same modules as above, so the next step's chunk is fetched while this step is filled in. */
const PRELOAD: Record<StepId, () => Promise<unknown>> = {
  business: () => import("./steps/business-step"),
  supports: () => import("./steps/supports-step"),
  practices: () => import("./steps/practices-step"),
  workforce: () => import("./steps/workforce-step"),
  existing: () => import("./steps/existing-step"),
  result: () => import("./steps/result-step"),
};

export function StepPage({ step }: { step: StepId }) {
  const router = useRouter();
  const { ready, answers, touchStep } = useQuestionnaire();
  const allowed = ready && canOpenStep(step, answers);

  // Fetch the next step's form the moment this one is first touched, so
  // the move between steps never shows the loading line; on first focus,
  // not on mount, so it stays out of the page's first-paint budget.
  const preloaded = useRef(false);
  const preloadNext = () => {
    if (preloaded.current) return;
    preloaded.current = true;
    const next = nextStep(step);
    if (next) void PRELOAD[next]().catch(() => undefined);
  };

  // FR-4: a later step is unreachable until the earlier ones are valid.
  useEffect(() => {
    if (ready && !allowed)
      router.replace(stepHref(firstIncompleteStep(answers)));
  }, [ready, allowed, answers, router]);

  useEffect(() => {
    if (ready && allowed) touchStep(step);
    // touchStep is stable per answers; we only want to run when the step opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, allowed, step]);

  const form =
    step === "business" ? (
      <BusinessStepForm />
    ) : step === "supports" ? (
      <SupportsStepForm />
    ) : step === "practices" ? (
      <PracticesStepForm />
    ) : step === "workforce" ? (
      <WorkforceStepForm />
    ) : step === "existing" ? (
      <ExistingStepForm />
    ) : null;

  if (!ready) {
    // Backlog 2 (D-1012): the step's form is in the server HTML, inert until
    // the draft has loaded, so the page's largest text paints with the first
    // paint instead of after the scripts have run (Lighthouse measured a 4 s
    // largest contentful paint on a throttled phone when the form arrived
    // only with hydration, and a 0.57 layout shift from the footer jumping).
    // The form remounts with the draft's answers once ready (the key below).
    // The result needs the answers, so it keeps a placeholder of a step's height.
    return (
      <StepShell step={step}>
        {form ? (
          // A disabled fieldset, not `inert`: a browser refuses input to both,
          // but only "disabled" is what an automated test waits on before it
          // types, so nothing is typed into the form before it is live.
          <fieldset
            key="loading"
            disabled
            aria-busy="true"
            className="m-0 min-h-[70vh] min-w-0 border-0 p-0"
          >
            {form}
          </fieldset>
        ) : (
          <div className="min-h-[70vh]">
            <p className="text-zinc-600 dark:text-zinc-400" role="status">
              Loading your draft…
            </p>
          </div>
        )}
      </StepShell>
    );
  }
  if (!allowed) return null;

  // The form remounts with the draft's answers only when the draft holds
  // some for this step; a first visit keeps the hydrated form (one render,
  // not two, inside the main-thread budget).
  const hasDraftAnswers =
    step !== "result" && Boolean(answers[step as keyof typeof answers]);
  return (
    <StepShell step={step}>
      <fieldset
        key={hasDraftAnswers ? "ready" : "loading"}
        className="m-0 min-w-0 border-0 p-0"
        onFocusCapture={preloadNext}
      >
        {form}
        {step === "result" && <ResultStep />}
      </fieldset>
    </StepShell>
  );
}
