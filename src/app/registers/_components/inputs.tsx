"use client";
/**
 * Form pieces the register forms share (REQ-009 Session B, FR-5; REQ-015
 * Sections C and D): a native select, a date input, a reference-code input
 * with the hint beside it, and a free-text area that warns (never blocks)
 * when the text looks like a participant's details.
 */
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { detectParticipantData } from "@/lib/privacy/participant-data";
import { Field } from "@/app/start/_components/fields";

const inputClass =
  "block w-full min-h-12 rounded-md border border-line bg-surface px-3 py-2 text-base text-ink shadow-sm focus:border-ink focus:outline-2 focus:outline-offset-1 focus:outline-ink ";
const invalidClass = "border-red-700 dark:border-red-400";

export function SelectField<V extends string>({
  id,
  label,
  help,
  errors,
  value,
  onChange,
  options,
  placeholder = "Choose one",
}: {
  id: string;
  label: string;
  help?: ReactNode;
  errors: string[];
  value: V | "";
  onChange: (v: V | "") => void;
  options: readonly { value: V; label: string }[];
  placeholder?: string;
}) {
  return (
    <Field id={id} label={label} help={help} errors={errors}>
      {(describedBy, invalid) => (
        <select
          id={id}
          name={id}
          value={value}
          onChange={(e) => onChange(e.target.value as V | "")}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={`${inputClass} ${invalid ? invalidClass : ""}`}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function DateField({
  id,
  label,
  help,
  errors,
  value,
  onChange,
  optional = false,
  max,
}: {
  id: string;
  label: string;
  help?: ReactNode;
  errors: string[];
  value: string;
  onChange: (v: string) => void;
  optional?: boolean;
  /** The latest day the picker offers, as ISO (REQ-024 A0, D-2435: today for an adoption of the owner's own document). */
  max?: string;
}) {
  return (
    <Field
      id={id}
      label={optional ? `${label} (optional)` : label}
      help={help}
      errors={errors}
    >
      {(describedBy, invalid) => (
        <input
          type="date"
          id={id}
          name={id}
          value={value}
          max={max}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={`${inputClass} max-w-60 ${invalid ? invalidClass : ""}`}
        />
      )}
    </Field>
  );
}

/** A reference code, never a name: the hint says the pattern and the input upper-cases as you type. */
export function RefField({
  id,
  label,
  hint,
  errors,
  value,
  onChange,
  optional = true,
}: {
  id: string;
  label: string;
  hint: string;
  errors: string[];
  value: string;
  onChange: (v: string) => void;
  optional?: boolean;
}) {
  return (
    <Field
      id={id}
      label={optional ? `${label} (optional)` : label}
      help={
        <>
          A code like {hint}, never a name.{" "}
          <Link
            href="/registers#codes"
            className="underline underline-offset-2"
          >
            How codes work
          </Link>
        </>
      }
      errors={errors}
    >
      {(describedBy, invalid) => (
        <input
          type="text"
          id={id}
          name={id}
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={20}
          placeholder={hint}
          className={`${inputClass} max-w-48 font-mono ${invalid ? invalidClass : ""}`}
        />
      )}
    </Field>
  );
}

/** Free text with the participant-data detector (CLAUDE.md 4.5): warns under the field, never blocks. */
export function SafeTextArea({
  id,
  label,
  help,
  errors,
  value,
  onChange,
  maxLength,
  rows = 3,
  optional = false,
}: {
  id: string;
  label: string;
  help?: ReactNode;
  errors: string[];
  value: string;
  onChange: (v: string) => void;
  maxLength: number;
  rows?: number;
  optional?: boolean;
}) {
  const warnId = useId();
  const [touched, setTouched] = useState(false);
  const warnings = touched ? detectParticipantData(value) : [];
  return (
    <Field
      id={id}
      label={optional ? `${label} (optional)` : label}
      help={
        help ??
        "No participant names, dates of birth, NDIS numbers, addresses or health details. Use codes like P-014."
      }
      errors={errors}
    >
      {(describedBy, invalid) => (
        <>
          <textarea
            id={id}
            name={id}
            value={value}
            rows={rows}
            maxLength={maxLength}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => setTouched(true)}
            aria-describedby={[describedBy, warnings.length ? warnId : null]
              .filter(Boolean)
              .join(" ")}
            aria-invalid={invalid || undefined}
            className={`${inputClass} min-h-24 ${invalid ? invalidClass : ""}`}
          />
          <p className="text-slate mt-1 text-right text-sm">
            {value.length} of {maxLength} characters
          </p>
          {warnings.length ? (
            <ul
              id={warnId}
              role="status"
              className="mt-1 space-y-1 rounded-md border border-amber-700 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-100"
              data-testid={`${id}-participant-warning`}
            >
              {warnings.map((w) => (
                <li key={w.kind}>{w.message}</li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </Field>
  );
}

export function CheckboxField({
  id,
  label,
  help,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  help?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const helpId = help ? `${id}-help` : undefined;
  return (
    <div className="mb-6">
      <label
        htmlFor={id}
        className="border-line has-[:checked]:border-ink flex min-h-12 cursor-pointer items-start gap-3 rounded-md border px-3 py-3"
      >
        <input
          type="checkbox"
          id={id}
          name={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby={helpId}
          className="mt-1 h-5 w-5 shrink-0"
        />
        <span className="text-base">{label}</span>
      </label>
      {help ? (
        <p id={helpId} className="text-slate mt-1 text-sm leading-6">
          {help}
        </p>
      ) : null}
    </div>
  );
}

/** The pending submit (REQ-015 FR-15) plus a cancel link back to the list. */
export function FormButtons({
  pending,
  label,
  cancelHref,
}: {
  pending: boolean;
  label: string;
  cancelHref: string;
}) {
  return (
    <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
      <a href={cancelHref} className="btn-secondary">
        Cancel
      </a>
      <button
        type="submit"
        className="btn-primary"
        disabled={pending}
        aria-busy={pending || undefined}
        data-testid="register-submit"
      >
        {pending ? "Saving…" : label}
      </button>
    </div>
  );
}
