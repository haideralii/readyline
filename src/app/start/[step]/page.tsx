import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { STEP_TITLES, isStepId } from "@/lib/questionnaire/navigation";
import type { StepId } from "@/lib/questionnaire/steps";
import { StepPage } from "../_components/step-page";
import { BusinessStepForm } from "../_components/steps/business-step";
import { ExistingStepForm } from "../_components/steps/existing-step";
import { PracticesStepForm } from "../_components/steps/practices-step";
import { ResultStep } from "../_components/steps/result-step";
import { SupportsStepForm } from "../_components/steps/supports-step";
import { WorkforceStepForm } from "../_components/steps/workforce-step";

export async function generateMetadata({
  params,
}: PageProps<"/start/[step]">): Promise<Metadata> {
  const { step } = await params;
  return { title: isStepId(step) ? STEP_TITLES[step] : "Questionnaire" };
}

/**
 * The step's own component, chosen here on the server (D-1012: one chunk per
 * step, since the payload references only the client module it renders), so
 * the form is in the page's first HTML and never in a streamed Suspense
 * segment. A streamed segment arrives hidden at the end of the body and is
 * moved into place by an inline script; on a slow runner the questionnaire's
 * `ready` flip rendered the form on the client before that script ran, and
 * two copies of every control, with the same ids, stood in the DOM (#40,
 * run 38637072132).
 */
function stepContent(step: StepId) {
  switch (step) {
    case "business":
      return <BusinessStepForm />;
    case "supports":
      return <SupportsStepForm />;
    case "practices":
      return <PracticesStepForm />;
    case "workforce":
      return <WorkforceStepForm />;
    case "existing":
      return <ExistingStepForm />;
    case "result":
      return <ResultStep />;
  }
}

export default async function QuestionnaireStepPage({
  params,
}: PageProps<"/start/[step]">) {
  const { step } = await params;
  if (!isStepId(step)) notFound();
  return <StepPage step={step}>{stepContent(step)}</StepPage>;
}
