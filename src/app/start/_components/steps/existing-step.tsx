"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { stepHref } from "@/lib/questionnaire/navigation";
import type {
  QuestionnaireAnswers,
  YesNoUnsure,
} from "@/lib/questionnaire/schema";
import { parseStep } from "@/lib/questionnaire/validate-step";
import {
  ErrorSummary,
  RadioGroup,
  StepButtons,
  errorsFor,
  type FieldErrors,
} from "../fields";
import { revalidateField } from "../field-errors";
import { useQuestionnaire } from "../questionnaire-provider";

type Key = keyof QuestionnaireAnswers["existing"];

const ITEMS: { key: Key; legend: string; help: string }[] = [
  {
    key: "policies",
    legend: "Written policies and procedures",
    help: "Any set of written policies, even old or borrowed ones.",
  },
  {
    key: "incidentRegister",
    legend: "An incident register",
    help: "A log of incidents and what you did about them.",
  },
  {
    key: "complaintsRegister",
    legend: "A complaints register",
    help: "A log of complaints and feedback and how each was resolved.",
  },
  {
    key: "insuranceCertificate",
    legend: "Current insurance certificates",
    help: "Professional indemnity, public liability and personal accident cover.",
  },
  {
    key: "workerInductionRecords",
    legend: "Worker induction and training records",
    help: "Evidence of induction, the NDIS worker orientation module and training.",
  },
];

const OPTIONS: { value: YesNoUnsure; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "not-sure", label: "Not sure" },
];

const LABELS = Object.fromEntries(ITEMS.map((i) => [i.key, i.legend]));

export function ExistingStepForm() {
  const router = useRouter();
  const { answers, saveStep } = useQuestionnaire();
  const [values, setValues] = useState<Partial<Record<Key, YesNoUnsure>>>(
    answers.existing ?? {},
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  // Live QA D1: the submit count the error summary focuses on.
  const [attempt, setAttempt] = useState(0);
  // REQ-028 FR-3 (AC-3): a field that carries an error is re-validated on
  // change and its message, summary entry and aria-invalid go when it passes.
  const clear = async (name: string, values: unknown) =>
    setErrors(await revalidateField("existing", values, name, errors));
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAttempt((a) => a + 1);
    const parsed = await parseStep("existing", values);
    if (!parsed.ok) {
      setErrors(parsed.fieldErrors);
      return;
    }
    setErrors({});
    setPending(true);
    await saveStep("existing", parsed.data, "result");
    router.push(stepHref("result"));
  }

  return (
    <form onSubmit={onSubmit} noValidate className="step-form">
      {/* REQ-025 FR-1, D-2216: what these answers do and do not change, in two lines. */}
      <div
        className="text-ink mb-6 space-y-2 text-base leading-7"
        data-testid="existing-intro"
      >
        <p>
          Your answers here pre-tick your readiness checklist, so you can see
          what is missing today.
        </p>
        <p>
          They do not change which standards apply or what your pack contains:
          the pack drafts the full set so every document matches. Not sure
          counts as no.
        </p>
      </div>
      <ErrorSummary errors={errors} labels={LABELS} attempt={attempt} />
      {ITEMS.map((item) => (
        <RadioGroup
          key={item.key}
          name={item.key}
          legend={`Do you have: ${item.legend.toLowerCase()}?`}
          help={item.help}
          options={OPTIONS}
          value={values[item.key]}
          onChange={(v) => {
            const next = { ...values, [item.key]: v };
            setValues(next);
            void clear(item.key, next);
          }}
          errors={errorsFor(errors, item.key)}
        />
      ))}
      <StepButtons
        pending={pending}
        backHref={stepHref("workforce")}
        nextLabel="See my result"
      />
    </form>
  );
}
