"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, TextInput } from "@/app/start/_components/fields";
import { INCIDENT_COLUMNS } from "@/lib/registers/names";
import {
  INCIDENT_CATEGORIES_24H,
  INCIDENT_CATEGORIES_5BD,
  type IncidentCategory,
} from "@/lib/registers/types";
import {
  confirmReportAction,
  rejectReportAction,
} from "@/server/registers/report-actions";
import {
  CheckboxField,
  DateField,
  SafeTextArea,
} from "../../../_components/inputs";

/**
 * One screen, one button (REQ-020 FR-6, REQ-017 FR-5): the owner says
 * whether the report is reportable, when the Commission was told if it
 * has been, and confirms. Reject sits folded under it with its reason;
 * the rejected report is kept. One in a reportable category keeps its
 * Commission clock (retro finding 62, Incident Rules s 17); any other
 * counts nowhere.
 */
export function ConfirmReportForm({
  id,
  category,
}: {
  id: string;
  category: IncidentCategory;
}) {
  const router = useRouter();
  const suggested = [
    ...INCIDENT_CATEGORIES_24H,
    ...INCIDENT_CATEGORIES_5BD,
  ].includes(category);
  const [reportable, setReportable] = useState(false);
  const [notifiedOn, setNotifiedOn] = useState("");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<"confirm" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setPending("confirm");
    setError(null);
    try {
      const r = await confirmReportAction({
        id,
        reportable,
        reportableNotifiedOn: reportable ? notifiedOn : "",
        commissionReference: reportable ? reference : "",
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      router.push(`/registers/incidents/${id}?saved=1`);
    } catch {
      setError(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setPending(null);
    }
  }

  async function reject(e: React.FormEvent) {
    e.preventDefault();
    setPending("reject");
    setError(null);
    try {
      const r = await rejectReportAction({ id, reason });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      router.push(`/registers/incidents/${id}`);
    } catch {
      setError(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mt-8" data-testid="confirm-report">
      <form onSubmit={confirm} noValidate>
        <h2 className="">Confirm it into your register</h2>
        <p className="text-ink mt-1 mb-4 text-sm leading-6">
          {suggested
            ? "This category is reportable when it happened in connection with your supports. You decide; the Commission's rules apply."
            : "This category is not usually reportable. Tick the box if you decide it is."}
        </p>
        <CheckboxField
          id="reportable"
          label="Reportable to the Commission"
          checked={reportable}
          onChange={setReportable}
        />
        {reportable ? (
          <>
            <DateField
              id="reportableNotifiedOn"
              label="Date you told the Commission"
              errors={[]}
              value={notifiedOn}
              onChange={setNotifiedOn}
              optional
            />
            <Field
              id="commissionReference"
              label={`${INCIDENT_COLUMNS.commission_reference} (optional)`}
              help="The reference the Commission gave you when you told them. Letters and digits; never a participant's number."
              errors={[]}
            >
              {(describedBy, invalid) => (
                <TextInput
                  id="commissionReference"
                  name="commissionReference"
                  value={reference}
                  onChange={setReference}
                  describedBy={describedBy}
                  invalid={invalid}
                  maxLength={40}
                />
              )}
            </Field>
          </>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="mt-3 text-sm leading-6"
            data-testid="confirm-error"
          >
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="btn-primary mt-4"
          disabled={pending !== null}
          aria-busy={pending === "confirm" || undefined}
          data-testid="confirm-report-submit"
        >
          {pending === "confirm" ? "Confirming…" : "Confirm this incident"}
        </button>
      </form>

      <details className="mt-8" data-testid="reject-report">
        <summary className="inline-flex min-h-11 cursor-pointer items-center underline-offset-4 hover:underline">
          Not an incident? Reject it
        </summary>
        <form onSubmit={reject} noValidate className="mt-3">
          {suggested ? (
            // Retro finding 62: Incident Rules s 17 reads "reportable
            // incident" as including one alleged to have occurred, so the
            // allegation keeps its clock; the rejected report stays in the
            // register as received, not recorded.
            <p
              className="border-signal mb-3 rounded-md border p-3 text-sm leading-6"
              data-testid="reject-still-reportable"
            >
              An allegation of this kind is still reportable; rejecting the
              report does not stop the Commission&apos;s clock. The report stays
              in your register as received, not recorded, with its notify-by
              date, until you record the date you told the Commission or that it
              is not reportable after all.
            </p>
          ) : null}
          <SafeTextArea
            id="reason"
            label="Why you are rejecting it"
            help="Kept with the report so an auditor can see it was read and why it was not recorded. Codes, never names."
            errors={[]}
            value={reason}
            onChange={setReason}
            maxLength={500}
            rows={3}
          />
          <button
            type="submit"
            className="btn-secondary"
            disabled={pending !== null || reason.trim().length === 0}
            aria-busy={pending === "reject" || undefined}
            data-testid="reject-report-submit"
          >
            {pending === "reject" ? "Rejecting…" : "Reject this report"}
          </button>
        </form>
      </details>
    </div>
  );
}
