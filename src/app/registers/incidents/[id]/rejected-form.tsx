"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, TextInput } from "@/app/start/_components/fields";
import { INCIDENT_COLUMNS } from "@/lib/registers/names";
import { settleRejectedReportAction } from "@/server/registers/report-actions";
import { DateField, SafeTextArea } from "../../_components/inputs";

/**
 * Retro finding 62: a rejected report in a reportable category is an alleged
 * reportable incident (Incident Rules s 17), so its row reads "received, not
 * recorded" with its notify-by date until the owner records here the date
 * the Commission was told, or that it is not reportable after all.
 */
export function RejectedReportForm({
  id,
  notifiedOn: already,
}: {
  id: string;
  notifiedOn: string | null;
}) {
  const router = useRouter();
  const [notifiedOn, setNotifiedOn] = useState("");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<"notified" | "not" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(kind: "notified" | "not") {
    setPending(kind);
    setError(null);
    try {
      const r = await settleRejectedReportAction({
        id,
        notifiedOn: kind === "notified" ? notifiedOn : "",
        commissionReference: kind === "notified" ? reference : "",
        notReportable: kind === "not",
        reason: kind === "not" ? reason : "",
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      router.push(`/registers/incidents/${id}?saved=1`);
      router.refresh();
    } catch {
      setError(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <div
      className="border-signal mt-5 rounded-md border p-3"
      data-testid="rejected-report-settle"
    >
      <p className="text-sm leading-6">
        You rejected this report, but an allegation of this kind is still
        reportable, so it stays in your register as received, not recorded.
        {already
          ? " You have recorded the date you told the Commission."
          : " Record the date you told the Commission, or that it is not reportable after all."}
      </p>
      {already ? null : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit("notified");
          }}
          noValidate
          className="mt-3"
        >
          <DateField
            id="rejectedNotifiedOn"
            label="Date you told the Commission"
            errors={[]}
            value={notifiedOn}
            onChange={setNotifiedOn}
          />
          <Field
            id="rejectedCommissionReference"
            label={`${INCIDENT_COLUMNS.commission_reference} (optional)`}
            help="The reference the Commission gave you. Letters and digits; never a participant's number."
            errors={[]}
          >
            {(describedBy, invalid) => (
              <TextInput
                id="rejectedCommissionReference"
                name="rejectedCommissionReference"
                value={reference}
                onChange={setReference}
                describedBy={describedBy}
                invalid={invalid}
                maxLength={40}
              />
            )}
          </Field>
          <button
            type="submit"
            className="btn-primary mt-2"
            disabled={pending !== null || notifiedOn === ""}
            aria-busy={pending === "notified" || undefined}
            data-testid="rejected-notified-submit"
          >
            {pending === "notified" ? "Saving…" : "Record the notification"}
          </button>
        </form>
      )}
      <details className="mt-4" data-testid="rejected-not-reportable">
        <summary className="inline-flex min-h-11 cursor-pointer items-center underline-offset-4 hover:underline">
          Not reportable after all?
        </summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit("not");
          }}
          noValidate
          className="mt-3"
        >
          <SafeTextArea
            id="notReportableReason"
            label="Why it is not reportable"
            help="Kept with the report as the record of your decision. Codes, never names."
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
            aria-busy={pending === "not" || undefined}
            data-testid="rejected-not-reportable-submit"
          >
            {pending === "not" ? "Saving…" : "Record that it is not reportable"}
          </button>
        </form>
      </details>
      {error ? (
        <p
          role="alert"
          className="mt-3 text-sm leading-6"
          data-testid="rejected-settle-error"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
