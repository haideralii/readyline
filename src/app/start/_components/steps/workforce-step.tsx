"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { stepHref } from "@/lib/questionnaire/navigation";
import { LARGE_PROVIDER_THRESHOLD } from "@/lib/questionnaire/steps";
import { parseStep } from "@/lib/questionnaire/validate-step";
import {
  ErrorSummary,
  Field,
  NumberInput,
  RadioGroup,
  StepButtons,
  errorsFor,
  type FieldErrors,
} from "../fields";
import { useQuestionnaire } from "../questionnaire-provider";
import { GlossaryTerms } from "@/components/glossary-terms";

/** REQ-027 FR-3 (D-2710, D-2705): the glossary terms this step's words use, first appearance first; the key-personnel meaning reaches the page here. */
const STEP_TERMS = ["key-personnel", "worker-screening-check"] as const;

const LABELS = {
  workerCount: "Number of workers",
  keyPersonnelCount: "Number of key personnel",
  hasRiskAssessedRoles: "Risk-assessed roles",
  allRiskAssessedScreened: "Worker screening",
};

type YesNo = "yes" | "no";
type Screening = "yes" | "no" | "not-sure" | "not-applicable";

export function WorkforceStepForm() {
  const router = useRouter();
  const { answers, saveStep } = useQuestionnaire();
  const saved = answers.workforce;
  // REQ-013 FR-6: a sole trader starts from the usual answers and can change them.
  const soleTrader = !saved && answers.business?.structure === "sole-trader";
  const [workerCount, setWorkerCount] = useState(
    saved ? String(saved.workerCount) : soleTrader ? "1" : "",
  );
  const [keyPersonnelCount, setKeyPersonnelCount] = useState(
    saved ? String(saved.keyPersonnelCount) : soleTrader ? "1" : "",
  );
  const [hasRisk, setHasRisk] = useState<YesNo | undefined>(
    saved
      ? saved.hasRiskAssessedRoles
        ? "yes"
        : "no"
      : soleTrader
        ? "yes"
        : undefined,
  );
  const [screened, setScreened] = useState<Screening | undefined>(
    saved?.allRiskAssessedScreened,
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  const large = Number(workerCount) > LARGE_PROVIDER_THRESHOLD;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = await parseStep("workforce", {
      workerCount: workerCount === "" ? undefined : Number(workerCount),
      keyPersonnelCount:
        keyPersonnelCount === "" ? undefined : Number(keyPersonnelCount),
      hasRiskAssessedRoles:
        hasRisk === undefined ? undefined : hasRisk === "yes",
      allRiskAssessedScreened: screened,
    });
    if (!parsed.ok) {
      setErrors(parsed.fieldErrors);
      return;
    }
    setErrors({});
    setPending(true);
    await saveStep("workforce", parsed.data, "existing");
    router.push(stepHref("existing"));
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <ErrorSummary errors={errors} labels={LABELS} />
      {/* REQ-027 FR-3, D-2701: the words on this step (both with their `more`), above its first question. */}
      <GlossaryTerms ids={STEP_TERMS} where="page" className="mb-4" />
      {soleTrader ? (
        <p
          className="mb-6 text-sm leading-6 text-zinc-600 dark:text-zinc-400"
          data-testid="workforce-defaults-note"
        >
          You said you are a sole trader, so we have filled in the usual
          answers. Change anything that is different for you.
        </p>
      ) : null}
      <Field
        id="workerCount"
        label={LABELS.workerCount}
        help="Including yourself, and anyone who delivers supports for you, employed or contracted."
        errors={errorsFor(errors, "workerCount")}
      >
        {(describedBy, invalid) => (
          <NumberInput
            id="workerCount"
            name="workerCount"
            value={workerCount}
            onChange={setWorkerCount}
            describedBy={describedBy}
            invalid={invalid}
            min={1}
            max={500}
          />
        )}
      </Field>
      {large ? (
        <p
          className="-mt-3 mb-6 text-sm leading-6 text-zinc-600 dark:text-zinc-400"
          role="status"
        >
          Readyline is built for providers with up to about 10 workers. You can
          continue; the result is the same, but larger organisations may need
          more than our documents provide.
        </p>
      ) : null}

      <Field
        id="keyPersonnelCount"
        label={LABELS.keyPersonnelCount}
        help="People who make decisions about the business. Examples: the owner, a director, the manager who hires workers or signs service agreements. For a sole trader that is you: 1."
        errors={errorsFor(errors, "keyPersonnelCount")}
      >
        {(describedBy, invalid) => (
          <NumberInput
            id="keyPersonnelCount"
            name="keyPersonnelCount"
            value={keyPersonnelCount}
            onChange={setKeyPersonnelCount}
            describedBy={describedBy}
            invalid={invalid}
            min={1}
            max={50}
          />
        )}
      </Field>

      <RadioGroup
        name="hasRiskAssessedRoles"
        legend="Does anyone work in a risk-assessed role?"
        help="Roles with more than incidental contact with participants, key personnel, and roles the Commission's rules list. Examples: a support worker who helps someone shower or get out, a coordinator who visits participants, and you as the owner. Most support workers are in risk-assessed roles."
        options={[
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ]}
        value={hasRisk}
        onChange={setHasRisk}
        errors={errorsFor(errors, "hasRiskAssessedRoles")}
      />

      <RadioGroup
        name="allRiskAssessedScreened"
        legend="Do all workers in risk-assessed roles hold a current NDIS Worker Screening clearance?"
        options={[
          { value: "yes", label: "Yes, all of them" },
          { value: "no", label: "No, not yet" },
          { value: "not-sure", label: "Not sure" },
          {
            value: "not-applicable",
            label: "Not applicable (no risk-assessed roles)",
          },
        ]}
        value={screened}
        onChange={setScreened}
        errors={errorsFor(errors, "allRiskAssessedScreened")}
      />

      <StepButtons pending={pending} backHref={stepHref("practices")} />
    </form>
  );
}
