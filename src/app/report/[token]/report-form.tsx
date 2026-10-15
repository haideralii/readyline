"use client";
import { useState } from "react";
import {
  ErrorSummary,
  Field,
  ParticipantDataWarning,
  TextArea,
  errorsFor,
  type FieldErrors,
} from "@/app/start/_components/fields";
import {
  DateField,
  RefField,
  SelectField,
} from "@/app/registers/_components/inputs";
import { CATEGORY_LABELS, SEVERITY_LABELS } from "@/lib/registers/labels";
import {
  INCIDENT_CATEGORIES,
  INCIDENT_SEVERITIES,
  TEXT_CAPS,
} from "@/lib/registers/types";
import {
  REPORTER_ROLES,
  REPORT_THANKS,
  ReportForm as Schema,
  type ReportFormValues,
} from "@/lib/registers/worker";
import { parseInput } from "@/lib/validation";
import { submitReportAction } from "@/server/registers/report-actions";

const LABELS: Record<string, string> = {
  occurredOn: "Date it happened",
  category: "What happened",
  severity: "How serious it was",
  participantRef: "Participant code",
  workerRef: "Worker involved",
  summary: "What happened, in a sentence or two",
  actionsTaken: "What was done straight away",
  reporter: "Who are you",
  form: "Report",
};

function today(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
  }).format(new Date());
}

export function ReportForm({
  token,
  workerCodes,
}: {
  token: string;
  workerCodes: string[];
}) {
  const [v, setV] = useState<ReportFormValues>({
    occurredOn: today(),
    category: "" as ReportFormValues["category"],
    severity: "" as ReportFormValues["severity"],
    participantRef: "",
    workerRef: "",
    summary: "",
    actionsTaken: "",
    reporter: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const set = <K extends keyof ReportFormValues>(
    k: K,
    value: ReportFormValues[K],
  ) => setV((s) => ({ ...s, [k]: value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseInput(Schema, v);
    if (!parsed.ok) {
      setErrors({
        ...parsed.fieldErrors,
        ...(parsed.formErrors.length ? { form: parsed.formErrors } : {}),
      });
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const r = await submitReportAction({ token, values: v });
      if (!r.ok) {
        setErrors({ ...(r.fieldErrors ?? {}), form: [r.message] });
        return;
      }
      setDone(r.reference);
    } catch {
      setErrors({
        form: [
          "Could not reach the server. Check your connection and try again.",
        ],
      });
    } finally {
      setPending(false);
    }
  }

  if (done)
    return (
      <p
        role="status"
        className="mt-6 text-lg leading-8"
        data-testid="report-done"
      >
        {REPORT_THANKS} Your report is {done}.
      </p>
    );

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="mt-6"
      data-testid="report-form"
    >
      <ErrorSummary errors={errors} labels={LABELS} />
      <ParticipantDataWarning />
      <SelectField
        id="reporter"
        label={LABELS.reporter}
        errors={errorsFor(errors, "reporter")}
        value={v.reporter}
        onChange={(x) => set("reporter", x)}
        options={[
          ...workerCodes.map((c) => ({ value: c, label: `Worker ${c}` })),
          ...REPORTER_ROLES.map((r) => ({ value: r, label: r })),
        ]}
      />
      <DateField
        id="occurredOn"
        label={LABELS.occurredOn}
        errors={errorsFor(errors, "occurredOn")}
        value={v.occurredOn}
        onChange={(x) => set("occurredOn", x)}
      />
      <SelectField
        id="category"
        label={LABELS.category}
        errors={errorsFor(errors, "category")}
        value={v.category}
        onChange={(x) => set("category", x as ReportFormValues["category"])}
        options={INCIDENT_CATEGORIES.map((c) => ({
          value: c,
          label: CATEGORY_LABELS[c],
        }))}
      />
      <SelectField
        id="severity"
        label={LABELS.severity}
        errors={errorsFor(errors, "severity")}
        value={v.severity}
        onChange={(x) => set("severity", x as ReportFormValues["severity"])}
        options={INCIDENT_SEVERITIES.map((s) => ({
          value: s,
          label: SEVERITY_LABELS[s],
        }))}
      />
      <RefField
        id="participantRef"
        label={`${LABELS.participantRef} (optional)`}
        hint="P-014"
        errors={errorsFor(errors, "participantRef")}
        value={v.participantRef ?? ""}
        onChange={(x) => set("participantRef", x)}
        optional
      />
      <RefField
        id="workerRef"
        label={`${LABELS.workerRef} (optional)`}
        hint="W-003"
        errors={errorsFor(errors, "workerRef")}
        value={v.workerRef ?? ""}
        onChange={(x) => set("workerRef", x)}
        optional
      />
      <Field
        id="summary"
        label={LABELS.summary}
        errors={errorsFor(errors, "summary")}
      >
        {(describedBy, invalid) => (
          <TextArea
            id="summary"
            name="summary"
            value={v.summary}
            onChange={(x) => set("summary", x)}
            describedBy={describedBy}
            invalid={invalid}
            maxLength={TEXT_CAPS.summary}
            rows={3}
          />
        )}
      </Field>
      <Field
        id="actionsTaken"
        label={`${LABELS.actionsTaken} (optional)`}
        errors={errorsFor(errors, "actionsTaken")}
      >
        {(describedBy, invalid) => (
          <TextArea
            id="actionsTaken"
            name="actionsTaken"
            value={v.actionsTaken ?? ""}
            onChange={(x) => set("actionsTaken", x)}
            describedBy={describedBy}
            invalid={invalid}
            maxLength={TEXT_CAPS.actionsTaken}
            rows={3}
          />
        )}
      </Field>
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending || undefined}
        className="btn-primary mt-6"
        data-testid="report-submit"
      >
        {pending ? "Sending…" : "Send the report"}
      </button>
    </form>
  );
}
