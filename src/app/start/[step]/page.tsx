import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { STEP_TITLES, isStepId } from "@/lib/questionnaire/navigation";
import { countEvent } from "@/server/metrics/counters";
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
  // Batch 45 item 12 (D-2002): results shown, counted per day, nothing per user.
  if (step === "result") countEvent("result-shown");
  return <StepPage step={step} />;
}
