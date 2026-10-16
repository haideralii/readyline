"use client";
/**
 * Form primitives for the questionnaire. Every control has a visible label,
 * optional help text and an inline error, all wired with aria-describedby;
 * touch targets are at least 44px (frontend-dev skill, AC-9, AC-11).
 *
 * REQ-013 FR-2: every radio and checkbox takes its accessible name from its
 * visible label text only (aria-labelledby), with help text and secondary
 * text (such as a class code) in aria-describedby, and every group is a
 * fieldset with a legend, so a screen reader announces the question and then
 * the human label of each option.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { numberText } from "@/lib/questionnaire/number-text";

export type FieldErrors = Record<string, string[]>;

export function errorsFor(errors: FieldErrors, name: string): string[] {
  return errors[name] ?? [];
}

const inputClass =
  "block w-full min-h-12 rounded-md border border-line bg-surface px-3 py-2 text-base text-ink shadow-sm focus:border-ink focus:outline-2 focus:outline-offset-1 focus:outline-ink";
const invalidClass = "border-red-700 dark:border-red-400";

export function Field({
  id,
  label,
  help,
  errors,
  children,
}: {
  id: string;
  label: string;
  help?: ReactNode;
  errors: string[];
  children: (describedBy: string | undefined, invalid: boolean) => ReactNode;
}) {
  const helpId = help ? `${id}-help` : undefined;
  const errorId = errors.length ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="mb-6">
      <label htmlFor={id} className="block text-base font-medium">
        {label}
      </label>
      {help ? (
        <p id={helpId} className="text-slate mt-1 text-sm leading-6">
          {help}
        </p>
      ) : null}
      <div className="mt-2">{children(describedBy, errors.length > 0)}</div>
      {errors.length ? (
        <p
          id={errorId}
          className="mt-2 text-sm font-medium text-red-700 dark:text-red-400"
        >
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput(props: {
  id: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  describedBy?: string;
  invalid: boolean;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "search";
  maxLength?: number;
}) {
  const { onChange, describedBy, invalid, ...rest } = props;
  return (
    <input
      type="text"
      {...rest}
      onChange={(e) => onChange(e.target.value)}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      className={`${inputClass} ${invalid ? invalidClass : ""}`}
    />
  );
}

export function NumberInput(props: {
  id: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  describedBy?: string;
  invalid: boolean;
  min?: number;
  max?: number;
}) {
  const { onChange, describedBy, invalid, ...rest } = props;
  // QA pass N8: what is typed survives as a number would read it (digits,
  // one point, a leading minus) and the schema refuses "2.5" or "-1" in
  // words; the old digit-only strip turned them into 25 and 1 silently.
  return (
    <input
      type="text"
      inputMode="decimal"
      {...rest}
      onChange={(e) => onChange(numberText(e.target.value))}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      className={`${inputClass} max-w-40 ${invalid ? invalidClass : ""}`}
    />
  );
}

export function TextArea(props: {
  id: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  describedBy?: string;
  invalid: boolean;
  maxLength: number;
  rows?: number;
}) {
  const {
    onChange,
    describedBy,
    invalid,
    maxLength,
    rows = 4,
    ...rest
  } = props;
  const counterId = `${rest.id}-count`;
  return (
    <>
      <textarea
        {...rest}
        rows={rows}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={[describedBy, counterId].filter(Boolean).join(" ")}
        aria-invalid={invalid || undefined}
        className={`${inputClass} min-h-28 ${invalid ? invalidClass : ""}`}
      />
      <p
        id={counterId}
        className="text-slate mt-1 text-right text-sm"
        aria-live="polite"
      >
        {rest.value.length} of {maxLength} characters
      </p>
    </>
  );
}

export type Option<V extends string> = {
  value: V;
  label: string;
  help?: string;
};

/** A radio or checkbox row: the visible label is the accessible name; help is a description. */
export function ChoiceRow({
  id,
  type,
  name,
  value,
  checked,
  onChange,
  label,
  help,
  secondary,
  tag,
}: {
  id: string;
  type: "radio" | "checkbox";
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: ReactNode;
  help?: ReactNode;
  /** Secondary text shown after the label, such as a class code; part of the description, not the name. */
  secondary?: ReactNode;
  tag?: ReactNode;
}) {
  const labelId = `${id}-label`;
  const helpId = help ? `${id}-help` : undefined;
  const secondaryId = secondary ? `${id}-secondary` : undefined;
  const describedBy =
    [secondaryId, helpId].filter(Boolean).join(" ") || undefined;
  return (
    <label
      htmlFor={id}
      className="border-line hover:bg-mist has-[:checked]:border-ink flex min-h-12 cursor-pointer items-start gap-3 rounded-md border px-3 py-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2"
    >
      <input
        type={type}
        id={id}
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        className="mt-1 h-5 w-5 shrink-0"
      />
      <span className="min-w-0">
        {/* R-2: the name leads; the code follows in muted text. R-3: tags never split, they wrap as a unit. */}
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base">
          <span id={labelId}>{label}</span>
          {secondary ? (
            <span id={secondaryId} className="text-slate font-mono text-sm">
              {secondary}
            </span>
          ) : null}
          {tag}
        </span>
        {help ? (
          <span id={helpId} className="text-slate block text-sm">
            {help}
          </span>
        ) : null}
      </span>
    </label>
  );
}

export function RadioGroup<V extends string>({
  name,
  legend,
  help,
  options,
  value,
  onChange,
  errors,
}: {
  name: string;
  legend: string;
  help?: ReactNode;
  options: Option<V>[];
  value: V | undefined;
  onChange: (v: V) => void;
  errors: string[];
}) {
  const helpId = help ? `${name}-help` : undefined;
  const errorId = errors.length ? `${name}-error` : undefined;
  return (
    <fieldset
      className="mb-6"
      aria-describedby={
        [helpId, errorId].filter(Boolean).join(" ") || undefined
      }
      aria-invalid={errors.length > 0 || undefined}
    >
      <legend className="text-base font-medium">{legend}</legend>
      {help ? (
        <p id={helpId} className="text-slate mt-1 text-sm leading-6">
          {help}
        </p>
      ) : null}
      <div className="mt-2 flex flex-col gap-2" id={name}>
        {options.map((o) => (
          <ChoiceRow
            key={o.value}
            id={`${name}-${o.value}`}
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            label={o.label}
            help={o.help}
          />
        ))}
      </div>
      {errors.length ? (
        <p
          id={errorId}
          className="mt-2 text-sm font-medium text-red-700 dark:text-red-400"
        >
          {errors[0]}
        </p>
      ) : null}
    </fieldset>
  );
}

export function CheckboxGroup<V extends string>({
  name,
  legend,
  help,
  options,
  values,
  onChange,
  errors,
}: {
  name: string;
  legend: string;
  help?: ReactNode;
  options: Option<V>[];
  values: V[];
  onChange: (v: V[]) => void;
  errors: string[];
}) {
  const helpId = help ? `${name}-help` : undefined;
  const errorId = errors.length ? `${name}-error` : undefined;
  const toggle = (v: V) =>
    onChange(
      values.includes(v) ? values.filter((x) => x !== v) : [...values, v],
    );
  return (
    <fieldset
      className="mb-6"
      aria-describedby={
        [helpId, errorId].filter(Boolean).join(" ") || undefined
      }
    >
      <legend className="text-base font-medium">{legend}</legend>
      {help ? (
        <p id={helpId} className="text-slate mt-1 text-sm leading-6">
          {help}
        </p>
      ) : null}
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4" id={name}>
        {options.map((o) => {
          const id = `${name}-${o.value}`;
          return (
            <label
              key={o.value}
              htmlFor={id}
              className="border-line hover:bg-mist has-[:checked]:border-ink flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2"
            >
              <input
                type="checkbox"
                id={id}
                name={name}
                value={o.value}
                checked={values.includes(o.value)}
                onChange={() => toggle(o.value)}
                aria-labelledby={`${id}-label`}
                className="h-5 w-5 shrink-0"
              />
              <span id={`${id}-label`} className="text-base">
                {o.label}
              </span>
            </label>
          );
        })}
      </div>
      {errors.length ? (
        <p
          id={errorId}
          className="mt-2 text-sm font-medium text-red-700 dark:text-red-400"
        >
          {errors[0]}
        </p>
      ) : null}
    </fieldset>
  );
}

/** Lists every error with a link to its control; focused when it appears (AC-11). */
export function ErrorSummary({
  errors,
  labels,
}: {
  errors: FieldErrors;
  labels: Record<string, string>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const entries = Object.entries(errors).filter(([, msgs]) => msgs.length > 0);
  useEffect(() => {
    if (entries.length) ref.current?.focus();
  }, [entries.length]);
  if (!entries.length) return null;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="mb-6 rounded-md border border-red-700 bg-red-50 p-4 outline-none dark:border-red-400 dark:bg-red-950"
    >
      <h2 className="">Please fix the following before continuing</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {entries.map(([name, msgs]) => (
          <li key={name}>
            <a
              href={`#${name.replace(/\./g, "-")}`}
              className="underline underline-offset-2"
            >
              {labels[name] ?? name}: {msgs[0]}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** REQ-015 FR-15: the submit shows it is working and cannot be tapped twice. */
export function StepButtons({
  backHref,
  nextLabel = "Save and continue",
  pending = false,
}: {
  backHref: string | null;
  nextLabel?: string;
  pending?: boolean;
}) {
  return (
    <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
      {backHref ? (
        <a href={backHref} className="btn-secondary">
          Back
        </a>
      ) : (
        <span />
      )}
      <button
        type="submit"
        className="btn-primary"
        disabled={pending}
        aria-busy={pending || undefined}
        data-testid="step-submit"
      >
        {pending ? (
          <>
            <Spinner />
            Saving…
          </>
        ) : (
          nextLabel
        )}
      </button>
    </div>
  );
}

/** A small turning ring beside a pending label; hidden from assistive tech (the label says it). */
export function Spinner() {
  return (
    <svg
      aria-hidden="true"
      className="mr-2 h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="3"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ParticipantDataWarning() {
  return (
    <span>
      Do not enter any participant&apos;s name, date of birth, NDIS number,
      address or health details. Describe your services in general terms; use a
      reference code such as P-014 if you must refer to a person.
    </span>
  );
}
