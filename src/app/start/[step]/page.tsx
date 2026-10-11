import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { STEP_TITLES, isStepId } from "@/lib/questionnaire/navigation";
import { StepPage } from "../_components/step-page";

export async function generateMetadata({
  params,
}: PageProps<"/start/[step]">): Promise<Metadata> {
  const { step } = await params;
  return { title: isStepId(step) ? STEP_TITLES[step] : "Questionnaire" };
}

export default async function QuestionnaireStepPage({
  params,
}: PageProps<"/start/[step]">) {
  const { step } = await params;
  if (!isStepId(step)) notFound();
  return <StepPage step={step} />;
}
