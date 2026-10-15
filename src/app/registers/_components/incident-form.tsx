"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ErrorSummary,
  Field,
  TextInput,
  errorsFor,
  type FieldErrors,
} from "@/app/start/_components/fields";
import { IncidentForm, type IncidentFormValues } from "@/lib/registers/forms";
import { INCIDENT_COLUMNS } from "@/lib/registers/names";
import {
  CATEGORY_LABELS,
  INCIDENT_STATUS_LABELS,
  SEVERITY_LABELS,
} from "@/lib/registers/labels";
import { incidentNotifyBy } from "@/lib/registers/status";
import {
  INCIDENT_CATEGORIES,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  TEXT_CAPS,
} from "@/lib/registers/types";
import { parseInput } from "@/lib/validation";
import { saveIncidentAction } from "@/server/registers/actions";
import {
  CheckboxField,
  DateField,
  FormButtons,
  RefField,
  SafeTextArea,
  SelectField,
} from "./inputs";

const LABELS: Record<string, string> = {
  occurredOn: "Date it happened",
  reportedOn: "Date it was reported",
  category: "What happened",
  severity: "How serious",
  participantRef: "Participant code",
  workerRef: "Worker code",
  summary: "What happened, in a sentence or two",
  actionsTaken: "What you did about it",
  reportable: "Reportable to the Commission",
  reportableNotifiedOn: "Date you told the Commission",
  commissionReference: INCIDENT_COLUMNS.commission_reference,
  status: "Status",
  closedOn: "Date closed",
  form: "Incident",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** The incident form (REQ-009 FR-5): add and edit share it; the server decides which. */
export function IncidentFormView({
  id,
  initial,
}: {
  id?: string;
  initial?: IncidentFormValues;
}) {
  const router = useRouter();
  const [v, setV] = useState<IncidentFormValues>(
    initial ?? {
      occurredOn: today(),
      reportedOn: today(),
      category: "" as IncidentFormValues["category"],
      severity: "" as IncidentFormValues["severity"],
      participantRef: "",
      workerRef: "",
      summary: "",
      actionsTaken: "",
      reportable: false,
      reportableNotifiedOn: "",
      commissionReference: "",
      status: "open",
      closedOn: "",
    },
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  const set = <K extends keyof IncidentFormValues>(
    k: K,
    value: IncidentFormValues[K],
  ) => setV((s) => ({ ...s, [k]: value }));

  const notifyBy =
    v.reportable &&
    v.category &&
    v.severity &&
    /^\d{4}-\d{2}-\d{2}$/.test(v.occurredOn)
      ? incidentNotifyBy(v.occurredOn, v.category, true, v.severity)
      : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseInput(IncidentForm, v);
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
      const r = await saveIncidentAction({ ...(id ? { id } : {}), values: v });
      if (!r.ok) {
        setErrors({ ...(r.fieldErrors ?? {}), form: [r.message] });
        return;
      }
      router.push(`/registers/incidents/${r.id}?saved=1`);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6">
      <ErrorSummary errors={errors} labels={LABELS} />
      <DateField
        id="occurredOn"
        label={LABELS.occurredOn}
        errors={errorsFor(errors, "occurredOn")}
        value={v.occurredOn}
        onChange={(x) => set("occurredOn", x)}
      />
      <DateField
        id="reportedOn"
        label={LABELS.reportedOn}
        errors={errorsFor(errors, "reportedOn")}
        value={v.reportedOn}
        onChange={(x) => set("reportedOn", x)}
      />
      <SelectField
        id="category"
        label={LABELS.category}
        errors={errorsFor(errors, "category")}
        value={v.category}
        onChange={(x) => set("category", x as IncidentFormValues["category"])}
        options={INCIDENT_CATEGORIES.map((c) => ({
          value: c,
          label: CATEGORY_LABELS[c],
        }))}
      />
      <SelectField
        id="severity"
        label={LABELS.severity}
        help="For an unauthorised restrictive practice: within 5 business days; within 24 hours if the use of a restrictive practice also caused serious injury or is itself abuse or neglect (Incident Rules ss 20 and 21). Medium or high here means harm."
        errors={errorsFor(errors, "severity")}
        value={v.severity}
        onChange={(x) => set("severity", x as IncidentFormValues["severity"])}
        options={INCIDENT_SEVERITIES.map((s) => ({
          value: s,
          label: SEVERITY_LABELS[s],
        }))}
      />
      <RefField
        id="participantRef"
        label={LABELS.participantRef}
        hint="P-014"
        errors={errorsFor(errors, "participantRef")}
        value={v.participantRef ?? ""}
        onChange={(x) => set("participantRef", x)}
      />
      <RefField
        id="workerRef"
        label={LABELS.workerRef}
        hint="W-003"
        errors={errorsFor(errors, "workerRef")}
        value={v.workerRef ?? ""}
        onChange={(x) => set("workerRef", x)}
      />
      <SafeTextArea
        id="summary"
        label={LABELS.summary}
        errors={errorsFor(errors, "summary")}
        value={v.summary}
        onChange={(x) => set("summary", x)}
        maxLength={TEXT_CAPS.summary}
      />
      <SafeTextArea
        id="actionsTaken"
        label={LABELS.actionsTaken}
        errors={errorsFor(errors, "actionsTaken")}
        value={v.actionsTaken ?? ""}
        onChange={(x) => set("actionsTaken", x)}
        maxLength={TEXT_CAPS.actionsTaken}
        rows={4}
        optional
      />
      <CheckboxField
        id="reportable"
        label={LABELS.reportable}
        help="The first six categories are reportable when they happened in connection with your supports. You decide; the Commission's rules apply."
        checked={v.reportable ?? false}
        onChange={(x) => set("reportable", x)}
      />
      {notifyBy ? (
        <p
          className="border-ochre mb-6 rounded-md border p-3 text-sm leading-6"
          role="status"
          data-testid="notify-by"
        >
          Notify the Commission by <strong>{notifyBy}</strong>.
        </p>
      ) : null}
      {v.reportable ? (
        <>
          <DateField
            id="reportableNotifiedOn"
            label={LABELS.reportableNotifiedOn}
            errors={errorsFor(errors, "reportableNotifiedOn")}
            value={v.reportableNotifiedOn ?? ""}
            onChange={(x) => set("reportableNotifiedOn", x)}
            optional
          />
          {/* Batch 45 (REQ-018-gated item): the reference the Commission gives back, on the row an auditor samples. */}
          <Field
            id="commissionReference"
            label={`${LABELS.commissionReference} (optional)`}
            help="The reference the Commission gave you when you told them. Letters and digits; never a participant's number."
            errors={errorsFor(errors, "commissionReference")}
          >
            {(describedBy, invalid) => (
              <TextInput
                id="commissionReference"
                name="commissionReference"
                value={v.commissionReference ?? ""}
                onChange={(x) => set("commissionReference", x)}
                describedBy={describedBy}
                invalid={invalid}
                maxLength={40}
              />
            )}
          </Field>
        </>
      ) : null}
      <SelectField
        id="status"
        label={LABELS.status}
        errors={errorsFor(errors, "status")}
        value={v.status ?? "open"}
        onChange={(x) =>
          set("status", (x || "open") as IncidentFormValues["status"])
        }
        options={INCIDENT_STATUSES.map((s) => ({
          value: s,
          label: INCIDENT_STATUS_LABELS[s],
        }))}
        placeholder="Open"
      />
      {v.status === "closed" ? (
        <DateField
          id="closedOn"
          label={LABELS.closedOn}
          errors={errorsFor(errors, "closedOn")}
          value={v.closedOn ?? ""}
          onChange={(x) => set("closedOn", x)}
        />
      ) : null}
      <FormButtons
        pending={pending}
        label={id ? "Save changes" : "Add the incident"}
        cancelHref={id ? `/registers/incidents/${id}` : "/registers/incidents"}
      />
    </form>
  );
}
