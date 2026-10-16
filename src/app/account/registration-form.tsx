"use client";
/**
 * "Your registration" (REQ-023 FR-1): the dates typed from the certificate,
 * the audit type, the optional override date with its source, the last-audit
 * and mid-term dates. One form, one Save; the server derives whether the
 * mid-term audit applies and the page re-reads it. Every field says where
 * its value comes from; nothing is pre-filled from an assumption (R-1).
 */
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { saveRegistrationPeriodAction } from "@/server/registers/registration-actions";

export type RegistrationFormValues = {
  id?: string;
  periodStartsOn: string;
  periodEndsOn: string;
  auditType: "certification" | "verification";
  midtermStartByOverride: string;
  midtermOverrideSource: "condition" | "letter" | "";
  lastAuditOn: string;
  midtermAuditOn: string;
};

const LABELS: Record<keyof Omit<RegistrationFormValues, "id">, string> = {
  periodStartsOn: "Registration period starts on",
  periodEndsOn: "Registration period ends on",
  auditType: "Audit type",
  midtermStartByOverride:
    "Date the Commissioner allowed or set for your mid-term audit to start by",
  midtermOverrideSource: "Where that date comes from",
  lastAuditOn: "Date of your last audit",
  midtermAuditOn: "Date your mid-term audit started",
};

const input =
  "mt-1 w-full max-w-xs rounded-md border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-950";

function DateField({
  name,
  label,
  value,
  help,
  errors,
  required,
  onChange,
}: {
  name: keyof RegistrationFormValues;
  label: string;
  value: string;
  help?: string;
  errors: string[];
  required?: boolean;
  onChange: (v: string) => void;
}) {
  const helpId = `${name}-help`;
  const errId = `${name}-error`;
  return (
    <div className="mt-4">
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
        {required ? "" : " (optional)"}
      </label>
      {help ? (
        <p
          id={helpId}
          className="mt-1 text-sm text-zinc-600 dark:text-zinc-400"
        >
          {help}
        </p>
      ) : null}
      <input
        id={name}
        name={name}
        type="date"
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={[help ? helpId : "", errors.length ? errId : ""]
          .filter(Boolean)
          .join(" ")}
        aria-invalid={errors.length > 0 || undefined}
        className={input}
      />
      {errors.length > 0 ? (
        <p id={errId} className="text-signal mt-1 text-sm" role="alert">
          {errors.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

export function RegistrationForm({
  initial,
  midterm,
  questionnaireDone,
}: {
  initial: RegistrationFormValues;
  /** What the last save derived (FR-1): applies, or the reason it does not. */
  midterm: { applies: boolean; reason: string | null } | null;
  questionnaireDone: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<RegistrationFormValues>(initial);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const set = <K extends keyof RegistrationFormValues>(
    key: K,
    v: RegistrationFormValues[K],
  ) => setValues((s) => ({ ...s, [key]: v }));
  const errs = (name: string) => fieldErrors[name] ?? [];

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    const r = await saveRegistrationPeriodAction(values);
    setBusy(false);
    if (r.ok) {
      setFieldErrors({});
      setFormErrors([]);
      setSaved(true);
      setValues((s) => ({ ...s, id: r.periodId }));
      router.refresh();
    } else {
      setFieldErrors(r.fieldErrors);
      setFormErrors(r.formErrors);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate data-testid="registration-form">
      {!questionnaireDone ? (
        <p
          className="mt-2 text-sm leading-6"
          data-testid="registration-needs-questionnaire"
        >
          Finish the questionnaire first: it tells us which classes you hold,
          and the mid-term audit rule reads them.
        </p>
      ) : null}
      {formErrors.length > 0 ? (
        <div
          role="alert"
          className="border-signal mt-3 rounded-md border p-3 text-sm"
          data-testid="registration-errors"
        >
          <p className="font-medium">Please fix the following before saving</p>
          <ul className="mt-1 list-disc pl-5">
            {formErrors.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <DateField
        name="periodStartsOn"
        label={LABELS.periodStartsOn}
        help="The first day of the period on your certificate, not the day the Commissioner wrote to you."
        value={values.periodStartsOn}
        errors={errs("periodStartsOn")}
        required
        onChange={(v) => set("periodStartsOn", v)}
      />
      <DateField
        name="periodEndsOn"
        label={LABELS.periodEndsOn}
        help="Three years is usual; the date on your certificate rules."
        value={values.periodEndsOn}
        errors={errs("periodEndsOn")}
        required
        onChange={(v) => set("periodEndsOn", v)}
      />

      <fieldset className="mt-4">
        <legend className="text-sm font-medium">{LABELS.auditType}</legend>
        <p
          id="auditType-help"
          className="mt-1 text-sm text-zinc-600 dark:text-zinc-400"
        >
          Certification if any class on your certificate is a certification
          class (Rules s 13B(1)); the questionnaire result is our reading of
          your classes.
        </p>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:gap-6">
          {(
            [
              ["certification", "Certification"],
              ["verification", "Verification"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              htmlFor={`auditType-${value}`}
              className="inline-flex min-h-11 items-center gap-2"
            >
              <input
                type="radio"
                id={`auditType-${value}`}
                name="auditType"
                value={value}
                checked={values.auditType === value}
                onChange={() => set("auditType", value)}
                aria-describedby="auditType-help"
                className="h-5 w-5"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {midterm ? (
        <p
          className="mt-3 text-sm leading-6"
          data-testid="registration-midterm"
          data-applies={midterm.applies ? "true" : "false"}
        >
          {midterm.applies
            ? "Your mid-term audit applies: it must start within 18 months of the period beginning (Rules s 13B(4)), or by the date the Commissioner allows."
            : `No mid-term audit: ${midterm.reason}.`}{" "}
          If the Commission registered you as a transitioned provider, the Rules
          exempt you too (s 13B(7)); we do not record that.
        </p>
      ) : null}

      <DateField
        name="midtermStartByOverride"
        label={LABELS.midtermStartByOverride}
        help="Only when a condition on your certificate or a letter from the Commissioner gives a date; it replaces the 18-month row."
        value={values.midtermStartByOverride}
        errors={errs("midtermStartByOverride")}
        onChange={(v) => set("midtermStartByOverride", v)}
      />
      {values.midtermStartByOverride ? (
        <fieldset className="mt-2">
          <legend className="text-sm font-medium">
            {LABELS.midtermOverrideSource}
          </legend>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:gap-6">
            {(
              [
                ["condition", "A condition on my certificate"],
                ["letter", "A letter from the Commissioner"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                htmlFor={`midtermOverrideSource-${value}`}
                className="inline-flex min-h-11 items-center gap-2"
              >
                <input
                  type="radio"
                  id={`midtermOverrideSource-${value}`}
                  name="midtermOverrideSource"
                  value={value}
                  checked={values.midtermOverrideSource === value}
                  onChange={() => set("midtermOverrideSource", value)}
                  className="h-5 w-5"
                />
                {label}
              </label>
            ))}
          </div>
          {errs("midtermOverrideSource").length > 0 ? (
            <p className="text-signal mt-1 text-sm" role="alert">
              {errs("midtermOverrideSource").join(" ")}
            </p>
          ) : null}
        </fieldset>
      ) : null}

      <DateField
        name="lastAuditOn"
        label={LABELS.lastAuditOn}
        help="Empty means not yet audited in this period."
        value={values.lastAuditOn}
        errors={errs("lastAuditOn")}
        onChange={(v) => set("lastAuditOn", v)}
      />
      <DateField
        name="midtermAuditOn"
        label={LABELS.midtermAuditOn}
        value={values.midtermAuditOn}
        errors={errs("midtermAuditOn")}
        onChange={(v) => set("midtermAuditOn", v)}
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="btn-primary"
          disabled={!hydrated || busy}
          data-testid="registration-save"
        >
          {busy ? "Saving…" : "Save my registration dates"}
        </button>
        <span
          role="status"
          aria-live="polite"
          className="text-sm text-zinc-600 dark:text-zinc-400"
          data-testid="registration-saved"
        >
          {saved ? "Saved." : ""}
        </span>
      </div>
    </form>
  );
}
