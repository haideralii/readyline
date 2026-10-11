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

export type FieldErrors = Record<string, string[]>;

export function errorsFor(errors: FieldErrors, name: string): string[] {
  return errors[name] ?? [];
}

const inputClass =
  "block w-full min-h-12 rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-2 focus:outline-offset-1 focus:outline-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100 dark:focus:outline-zinc-100";
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
        <p
          id={helpId}
          className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400"
        >
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
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      {...rest}
      onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
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
        className="mt-1 text-right text-xs text-zinc-500 dark:text-zinc-400"
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
  /** Secondary text shown before the label, such as a class code; part of the description, not the name. */
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
      className="flex min-h-12 cursor-pointer items-start gap-3 rounded-md border border-zinc-200 px-3 py-3 hover:bg-zinc-50 has-[:checked]:border-zinc-900 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 dark:border-zinc-800 dark:hover:bg-zinc-900 dark:has-[:checked]:border-zinc-100"
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
        <span className="block text-base">
          {secondary ? (
            <span
              id={secondaryId}
              className="mr-2 font-mono text-sm text-zinc-500 dark:text-zinc-400"
            >
              {secondary}
            </span>
          ) : null}
          <span id={labelId}>{label}</span>
          {tag}
        </span>
        {help ? (
          <span
            id={helpId}
            className="block text-sm text-zinc-600 dark:text-zinc-400"
          >
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
        <p
          id={helpId}
          className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400"
        >
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
        <p
          id={helpId}
          className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400"
        >
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
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-zinc-200 px-3 py-2 hover:bg-zinc-50 has-[:checked]:border-zinc-900 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 dark:border-zinc-800 dark:hover:bg-zinc-900 dark:has-[:checked]:border-zinc-100"
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
      <h2 className="text-base font-semibold">
        Please fix the following before continuing
      </h2>
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

export function StepButtons({
  backHref,
  nextLabel = "Save and continue",
}: {
  backHref: string | null;
  nextLabel?: string;
}) {
  return (
    <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
      {backHref ? (
        <a
          href={backHref}
          className="inline-flex min-h-12 items-center justify-center rounded-md border border-zinc-300 px-5 text-base font-medium hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Back
        </a>
      ) : (
        <span />
      )}
      <button
        type="submit"
        className="inline-flex min-h-12 items-center justify-center rounded-md bg-zinc-900 px-5 text-base font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {nextLabel}
      </button>
    </div>
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
