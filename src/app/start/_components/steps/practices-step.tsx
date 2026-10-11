"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { stepHref } from "@/lib/questionnaire/navigation";
import { PracticesStep, type YesNoUnsure } from "@/lib/questionnaire/schema";
import { parseInput } from "@/lib/validation";
import {
  ErrorSummary,
  RadioGroup,
  StepButtons,
  errorsFor,
  type FieldErrors,
} from "../fields";
import { useQuestionnaire } from "../questionnaire-provider";

const LABELS = { restrictivePractices: "Restrictive practices" };

const OPTIONS: { value: YesNoUnsure; label: string; help?: string }[] = [
  {
    value: "yes",
    label: "Yes",
    help: "We use or plan to use regulated restrictive practices with at least one participant.",
  },
  { value: "no", label: "No" },
  {
    value: "not-sure",
    label: "Not sure",
    help: "We will treat this as yes so your result includes the implementing behaviour support plans module, and say so.",
  },
];

export function PracticesStepForm() {
  const router = useRouter();
  const { answers, saveStep } = useQuestionnaire();
  const [value, setValue] = useState<YesNoUnsure | undefined>(
    answers.practices?.restrictivePractices,
  );
  const [errors, setErrors] = useState<FieldErrors>({});

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseInput(PracticesStep, { restrictivePractices: value });
    if (!parsed.ok) {
      setErrors(parsed.fieldErrors);
      return;
    }
    setErrors({});
    await saveStep("practices", parsed.data, "workforce");
    router.push(stepHref("workforce"));
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <ErrorSummary errors={errors} labels={LABELS} />
      <RadioGroup
        name="restrictivePractices"
        legend="Do you use, or plan to use, regulated restrictive practices?"
        help={
          <>
            Regulated restrictive practices are the practices the NDIS
            (Restrictive Practices and Behaviour Support) Rules 2018 regulate:
            seclusion, and chemical, mechanical, physical and environmental
            restraint. They may only be used under a behaviour support plan with
            any state or territory authorisation.{" "}
            <a
              href="https://www.ndiscommission.gov.au/rules-and-standards/behaviour-support-and-restrictive-practices"
              className="underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              Read the Commission&apos;s explanation (opens in a new tab)
            </a>
            . Providers using them must also meet the implementing behaviour
            support plans module, whatever their registration groups.
          </>
        }
        options={OPTIONS}
        value={value}
        onChange={setValue}
        errors={errorsFor(errors, "restrictivePractices")}
      />
      <StepButtons backHref={stepHref("supports")} />
    </form>
  );
}
