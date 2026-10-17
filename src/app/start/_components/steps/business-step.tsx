"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { stepHref } from "@/lib/questionnaire/navigation";
import type {
  BusinessStructureAnswer,
  State,
} from "@/lib/questionnaire/schema";
import { STATE_CODES } from "@/lib/questionnaire/steps";
import { parseStep } from "@/lib/questionnaire/validate-step";
import {
  CheckboxGroup,
  ErrorSummary,
  Field,
  RadioGroup,
  StepButtons,
  TextInput,
  errorsFor,
  type FieldErrors,
} from "../fields";
import { useQuestionnaire } from "../questionnaire-provider";

const STRUCTURES: {
  value: BusinessStructureAnswer;
  label: string;
  help?: string;
}[] = [
  {
    value: "sole-trader",
    label: "Sole trader",
    help: "You operate under your own ABN as an individual.",
  },
  { value: "partnership", label: "Partnership" },
  { value: "company", label: "Company (Pty Ltd)" },
  {
    value: "incorporated-association",
    label: "Incorporated association or not-for-profit",
  },
  { value: "trust", label: "Trust" },
  { value: "other", label: "Other" },
];

const STATES = STATE_CODES.map((s) => ({ value: s, label: s }));

const LABELS = {
  tradingName: "Trading name",
  structure: "Business structure",
  states: "States and territories",
  abn: "ABN",
};

export function BusinessStepForm() {
  const router = useRouter();
  const { answers, saveStep, accountPrefill } = useQuestionnaire();
  const saved = answers.business;
  // Batch 23 item 3 (D-1307): a signed-in owner's account details start the
  // step filled in, so nothing is typed twice; a saved draft still wins.
  const prefilled = !saved && accountPrefill ? accountPrefill : null;
  const [tradingName, setTradingName] = useState(
    saved?.tradingName ?? prefilled?.tradingName ?? "",
  );
  const [structure, setStructure] = useState<
    BusinessStructureAnswer | undefined
  >(
    saved?.structure ??
      (prefilled
        ? (prefilled.structure as BusinessStructureAnswer)
        : undefined),
  );
  const [states, setStates] = useState<State[]>(
    saved?.states ??
      (prefilled
        ? prefilled.states.filter((s): s is State =>
            (STATE_CODES as readonly string[]).includes(s),
          )
        : []),
  );
  const [abn, setAbn] = useState(saved?.abn ?? prefilled?.abn ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = await parseStep("business", {
      tradingName,
      structure,
      states,
      abn,
    });
    if (!parsed.ok) {
      setErrors({
        ...parsed.fieldErrors,
        ...(parsed.formErrors.length ? { form: parsed.formErrors } : {}),
      });
      return;
    }
    setErrors({});
    setPending(true);
    await saveStep("business", parsed.data, "supports");
    router.push(stepHref("supports"));
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <ErrorSummary errors={errors} labels={LABELS} />
      {prefilled ? (
        <p
          className="text-slate mb-6 text-sm leading-6"
          data-testid="business-prefill-note"
        >
          Filled in from your account. Change anything here; your account
          details stay as they are.
        </p>
      ) : null}
      <Field
        id="tradingName"
        label={LABELS.tradingName}
        help="The name participants and the Commission know you by. It appears on your documents."
        errors={errorsFor(errors, "tradingName")}
      >
        {(describedBy, invalid) => (
          <TextInput
            id="tradingName"
            name="tradingName"
            value={tradingName}
            onChange={setTradingName}
            describedBy={describedBy}
            invalid={invalid}
            autoComplete="organization"
            maxLength={120}
          />
        )}
      </Field>

      <RadioGroup
        name="structure"
        legend={LABELS.structure}
        // Batch 49 item 4: a first-screen sentence a new provider can parse; the early-childhood rule stays in the result's reasons.
        help="Your structure changes a few audit questions; pick the one on your ABN record."
        options={STRUCTURES}
        value={structure}
        onChange={setStructure}
        errors={errorsFor(errors, "structure")}
      />

      <CheckboxGroup
        name="states"
        legend={LABELS.states}
        help="Where you deliver supports. Choose every state or territory that applies."
        options={STATES}
        values={states}
        onChange={setStates}
        errors={errorsFor(errors, "states")}
      />

      <Field
        id="abn"
        label={`${LABELS.abn} (optional)`}
        help="11 digits, spaces allowed. We check the format only; we do not look it up."
        errors={errorsFor(errors, "abn")}
      >
        {(describedBy, invalid) => (
          <TextInput
            id="abn"
            name="abn"
            value={abn}
            onChange={setAbn}
            describedBy={describedBy}
            invalid={invalid}
            inputMode="numeric"
            maxLength={14}
          />
        )}
      </Field>

      <StepButtons pending={pending} backHref={null} />
    </form>
  );
}
