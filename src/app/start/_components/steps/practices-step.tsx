"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { stepHref } from "@/lib/questionnaire/navigation";
import type { NotSureHelper, YesNoUnsure } from "@/lib/questionnaire/schema";
import { resolveRestrictivePractices } from "@/lib/questionnaire/steps";
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
import { EXAMPLES, HELPER } from "./practices-copy";
import { GlossaryTerms } from "@/components/glossary-terms";

/** REQ-027 FR-3 (D-2710, D-2705): the glossary terms this step's words use, first appearance first; the restrictive-practice meaning reaches the page here. */
const STEP_TERMS = [
  "restrictive-practice",
  "module",
  "registration-group",
] as const;

const LABELS = {
  restrictivePractices: "Restrictive practices",
  "notSureHelper.locksOrBarriers": "Locks or barriers",
  "notSureHelper.holdsOrRestraint": "Holding or restraint",
  "notSureHelper.medicationForBehaviour": "Medicine for behaviour",
  notSureHelper: "The three helper questions",
};

const OPTIONS: { value: YesNoUnsure; label: string; help?: string }[] = [
  {
    value: "yes",
    label: "Yes",
    help: "We use or plan to use one of these with at least one participant.",
  },
  { value: "no", label: "No", help: "We do not use anything like this." },
  {
    value: "not-sure",
    label: "Not sure",
    help: "Three short questions will work it out with you.",
  },
];

type YesNo = "yes" | "no";
const YES_NO: { value: YesNo; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

export function PracticesStepForm() {
  const router = useRouter();
  const { answers, saveStep } = useQuestionnaire();
  const [value, setValue] = useState<YesNoUnsure | undefined>(
    answers.practices?.restrictivePractices,
  );
  const [helper, setHelper] = useState<
    Partial<Record<keyof NotSureHelper, YesNo>>
  >(
    answers.practices?.notSureHelper
      ? Object.fromEntries(
          Object.entries(answers.practices.notSureHelper).map(([k, v]) => [
            k,
            v ? "yes" : "no",
          ]),
        )
      : {},
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  // REQ-028 FR-3 (AC-3): a field that carries an error is re-validated on
  // change and its message, summary entry and aria-invalid go when it passes.
  const clear = async (name: string, values: unknown) =>
    setErrors(await revalidateField("practices", values, name, errors));
  const [pending, setPending] = useState(false);

  const helperComplete = HELPER.every((h) => helper[h.key] !== undefined);
  const preview =
    value === "not-sure" && helperComplete
      ? resolveRestrictivePractices("not-sure", {
          locksOrBarriers: helper.locksOrBarriers === "yes",
          holdsOrRestraint: helper.holdsOrRestraint === "yes",
          medicationForBehaviour: helper.medicationForBehaviour === "yes",
        })
      : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const values: Record<string, unknown> = { restrictivePractices: value };
    if (value === "not-sure") {
      if (!helperComplete) {
        const fieldErrors: FieldErrors = {};
        for (const h of HELPER)
          if (helper[h.key] === undefined)
            fieldErrors[`notSureHelper.${h.key}`] = ["Choose yes or no"];
        setErrors(fieldErrors);
        return;
      }
      values.notSureHelper = {
        locksOrBarriers: helper.locksOrBarriers === "yes",
        holdsOrRestraint: helper.holdsOrRestraint === "yes",
        medicationForBehaviour: helper.medicationForBehaviour === "yes",
      };
    }
    const parsed = await parseStep("practices", values);
    if (!parsed.ok) {
      setErrors(parsed.fieldErrors);
      return;
    }
    setErrors({});
    setPending(true);
    await saveStep("practices", parsed.data, "workforce");
    router.push(stepHref("workforce"));
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <ErrorSummary errors={errors} labels={LABELS} />
      {/* REQ-027 FR-3, D-2701: the words on this step, above its first paragraph. */}
      <GlossaryTerms ids={STEP_TERMS} where="page" className="mb-4" />
      <p className="text-ink mb-4 text-base leading-7">
        Some ways of keeping people safe count as restrictive practices and have
        extra rules. In plain words, they include:
      </p>
      <ul className="text-ink mb-4 list-disc space-y-1 pl-5 text-base leading-7">
        {EXAMPLES.map((example) => (
          <li key={example}>{example}</li>
        ))}
      </ul>
      <details className="border-rule mb-6 rounded-md border p-4">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium underline-offset-4 hover:underline">
          What counts? The Commission&apos;s definition
        </summary>
        <p className="text-ink mt-2 text-sm leading-6">
          The NDIS (Restrictive Practices and Behaviour Support) Rules 2018 name
          five: seclusion, and chemical, mechanical, physical and environmental
          restraint. They may only be used under a behaviour support plan, with
          any state or territory authorisation.
        </p>
        <p className="text-ink mt-2 text-sm leading-6">
          If you use them, the implementing behaviour support plans module
          applies to you, whatever your registration groups.{" "}
          <a
            href="https://www.ndiscommission.gov.au/rules-and-standards/behaviour-support-and-restrictive-practices"
            className="underline underline-offset-2"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read the Commission&apos;s explanation (opens in a new tab)
          </a>
          .
        </p>
      </details>

      <RadioGroup
        name="restrictivePractices"
        legend="Do you use, or plan to use, any of these with a participant?"
        options={OPTIONS}
        value={value}
        onChange={(v) => {
          setValue(v);
          void clear("restrictivePractices", { restrictivePractices: v });
        }}
        errors={errorsFor(errors, "restrictivePractices")}
      />

      {value === "not-sure" ? (
        <div
          className="border-rule mb-6 rounded-md border p-4"
          id="notSureHelper"
          data-testid="not-sure-helper"
        >
          <h2 className="">Three quick questions to work it out</h2>
          <div className="mt-4">
            {HELPER.map((h) => (
              <RadioGroup
                key={h.key}
                name={`notSureHelper.${h.key}`}
                legend={h.legend}
                help={h.help}
                options={YES_NO}
                value={helper[h.key]}
                onChange={(v) => {
                  const next = { ...helper, [h.key]: v };
                  setHelper(next);
                  void clear(`notSureHelper.${h.key}`, {
                    restrictivePractices: value,
                    notSureHelper: {
                      locksOrBarriers: next.locksOrBarriers === "yes",
                      holdsOrRestraint: next.holdsOrRestraint === "yes",
                      medicationForBehaviour:
                        next.medicationForBehaviour === "yes",
                    },
                  });
                }}
                errors={errorsFor(errors, `notSureHelper.${h.key}`)}
              />
            ))}
          </div>
          {preview ? (
            <p
              role="status"
              className="text-ink text-sm leading-6"
              data-testid="not-sure-resolution"
            >
              {preview.uses
                ? "Based on these answers we will treat this as yes and include the implementing behaviour support plans module. Your result will say so."
                : "Based on these answers we will treat this as no. Nothing extra is added."}
            </p>
          ) : null}
        </div>
      ) : null}

      <StepButtons pending={pending} backHref={stepHref("supports")} />
    </form>
  );
}
