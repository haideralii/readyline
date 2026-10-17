"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { BOOKING_HELP, type RenewalDatedStep } from "@/lib/path/renewal";
import { saveRenewalStepAction } from "@/server/registers/renewal-actions";

/**
 * One dated step's form (REQ-023 FR-7): the date, and for the booking the
 * auditing company's name; one button. Inert until hydrated (D-1012's rule:
 * a client form in the first HTML is disabled until live), `noValidate` so
 * the server's words answer.
 */
const noop = () => () => {};

export function RenewalStepForm({
  step,
  dateLabel,
  initialDate,
  initialAuditor,
}: {
  step: RenewalDatedStep;
  dateLabel: string;
  initialDate: string;
  initialAuditor: string;
}) {
  const router = useRouter();
  const live = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const [date, setDate] = useState(initialDate);
  const [auditor, setAuditor] = useState(initialAuditor);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});
    try {
      const r = await saveRenewalStepAction({
        step,
        date,
        ...(step === "booking" ? { auditorBusinessName: auditor.trim() } : {}),
      });
      if (!r.ok) {
        setError(r.message);
        setFieldErrors(r.fieldErrors ?? {});
        return;
      }
      router.push(`/path/renewal?saved=${step}`);
    } catch {
      setError(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="mt-6"
      data-testid={`renewal-form-${step}`}
    >
      <fieldset disabled={!live} className="min-w-0 border-0 p-0">
        <label htmlFor="renewal-date" className="block text-sm font-medium">
          {dateLabel}
        </label>
        <input
          id="renewal-date"
          name="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-invalid={fieldErrors.date ? true : undefined}
          className="border-line bg-surface text-ink mt-1 block min-h-12 w-full max-w-60 rounded-md border px-3 py-2 text-base shadow-sm"
        />
        {fieldErrors.date ? (
          <p
            className="mt-1 text-sm leading-6"
            role="alert"
            data-testid="renewal-error-date"
          >
            {fieldErrors.date.join(" ")}
          </p>
        ) : null}
        {step === "booking" ? (
          <>
            <label
              htmlFor="renewal-auditor"
              className="mt-4 block text-sm font-medium"
            >
              The auditing company
            </label>
            <p className="text-slate text-sm leading-6">{BOOKING_HELP}</p>
            <input
              id="renewal-auditor"
              name="auditorBusinessName"
              type="text"
              maxLength={80}
              value={auditor}
              onChange={(e) => setAuditor(e.target.value)}
              aria-invalid={fieldErrors.auditorBusinessName ? true : undefined}
              className="border-line bg-surface text-ink mt-1 block min-h-12 w-full rounded-md border px-3 py-2 text-base shadow-sm"
            />
            {fieldErrors.auditorBusinessName ? (
              <p
                className="mt-1 text-sm leading-6"
                role="alert"
                data-testid="renewal-error-auditor"
              >
                {fieldErrors.auditorBusinessName.join(" ")}
              </p>
            ) : null}
          </>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="mt-3 text-sm leading-6"
            data-testid="renewal-error"
          >
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="submit"
            className="btn-primary"
            disabled={pending}
            aria-busy={pending || undefined}
            data-testid="renewal-save"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <Link
            href="/path/renewal"
            className="inline-flex min-h-11 items-center underline underline-offset-4"
          >
            Back without saving
          </Link>
        </div>
      </fieldset>
    </form>
  );
}
