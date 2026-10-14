"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  canOpenStep,
  firstIncompleteStep,
  stepHref,
} from "@/lib/questionnaire/navigation";
import type { StepId } from "@/lib/questionnaire/schema";
import { BusinessStepForm } from "./steps/business-step";
import { ExistingStepForm } from "./steps/existing-step";
import { PracticesStepForm } from "./steps/practices-step";
import { ResultStep } from "./steps/result-step";
import { SupportsStepForm } from "./steps/supports-step";
import { WorkforceStepForm } from "./steps/workforce-step";
import { useQuestionnaire } from "./questionnaire-provider";
import { StepShell } from "./step-shell";

export function StepPage({ step }: { step: StepId }) {
  const router = useRouter();
  const { ready, answers, touchStep } = useQuestionnaire();
  const allowed = ready && canOpenStep(step, answers);

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
    // Batch 45b item 4: the step's form is in the server HTML, inert until
    // the draft has loaded, so the page a browser first paints is the page a
    // keyboard or a screen reader meets; before this the server HTML held
    // only "Loading your draft…", and a keyboard walk that began before the
    // draft arrived tabbed past the heading into the footer and wrapped
    // (CI run 443 on WebKit). The form remounts with the draft's answers
    // once ready (the key below). The result needs the answers, so it keeps
    // the loading line.
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
            className="m-0 min-w-0 border-0 p-0"
          >
            {form}
          </fieldset>
        ) : (
          <p className="text-zinc-600 dark:text-zinc-400" role="status">
            Loading your draft…
          </p>
        )}
      </StepShell>
    );
  }
  if (!allowed) return null;

  // The form remounts with the draft's answers only when the draft holds
  // some for this step; a first visit keeps the hydrated form.
  const hasDraftAnswers =
    step !== "result" && Boolean(answers[step as keyof typeof answers]);
  return (
    <StepShell step={step}>
      <fieldset
        key={hasDraftAnswers ? "ready" : "loading"}
        className="m-0 min-w-0 border-0 p-0"
      >
        {form}
        {step === "result" && <ResultStep />}
      </fieldset>
    </StepShell>
  );
}
