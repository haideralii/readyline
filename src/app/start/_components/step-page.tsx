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

  if (!ready) {
    return (
      <StepShell step={step}>
        <p className="text-zinc-600 dark:text-zinc-400" role="status">
          Loading your draft…
        </p>
      </StepShell>
    );
  }
  if (!allowed) return null;

  return (
    <StepShell step={step}>
      {step === "business" && <BusinessStepForm />}
      {step === "supports" && <SupportsStepForm />}
      {step === "practices" && <PracticesStepForm />}
      {step === "workforce" && <WorkforceStepForm />}
      {step === "existing" && <ExistingStepForm />}
      {step === "result" && <ResultStep />}
    </StepShell>
  );
}
