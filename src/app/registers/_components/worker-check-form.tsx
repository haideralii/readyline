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
import {
  WorkerCheckForm,
  suggestedExpiry,
  type WorkerCheckFormValues,
} from "@/lib/registers/forms";
import { CLEARANCE_LABELS } from "@/lib/registers/labels";
import { CLEARANCE_COLUMNS } from "@/lib/registers/names";
import { AU_STATES, CLEARANCE_KINDS, TEXT_CAPS } from "@/lib/registers/types";
import { parseInput } from "@/lib/validation";
import { saveWorkerCheckAction } from "@/server/registers/actions";
import {
  DateField,
  FormButtons,
  RefField,
  RegisterParticipantLine,
  SafeTextArea,
  SelectField,
} from "./inputs";

const LABELS: Record<string, string> = {
  workerRef: CLEARANCE_COLUMNS.worker_ref,
  roleLabel: CLEARANCE_COLUMNS.role_label,
  clearanceKind: CLEARANCE_COLUMNS.clearance_kind,
  clearanceNumber: CLEARANCE_COLUMNS.clearance_number,
  issuedOn: CLEARANCE_COLUMNS.issued_on,
  expiresOn: CLEARANCE_COLUMNS.expires_on,
  state: "State or territory",
  note: "Note",
  form: "Worker check",
};

export function WorkerCheckFormView({
  id,
  initial,
}: {
  id?: string;
  initial?: WorkerCheckFormValues;
}) {
  const router = useRouter();
  const [v, setV] = useState<WorkerCheckFormValues>(
    initial ?? {
      workerRef: "",
      roleLabel: "",
      clearanceKind: "" as WorkerCheckFormValues["clearanceKind"],
      clearanceNumber: "",
      applicationNumber: "",
      issuedOn: "",
      expiresOn: "",
      verifiedInDatabaseOn: "",
      state: "",
      note: "",
    },
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  const set = <K extends keyof WorkerCheckFormValues>(
    k: K,
    value: WorkerCheckFormValues[K],
  ) => setV((s) => ({ ...s, [k]: value }));

  /** PO answer 1: suggest 5 years for worker screening, none for the orientation module, blank otherwise. */
  function onKindOrIssued(
    kind: WorkerCheckFormValues["clearanceKind"],
    issued: string,
  ) {
    const suggestion = kind ? suggestedExpiry(kind, issued) : null;
    setV((s) => {
      const previous = s.clearanceKind
        ? suggestedExpiry(s.clearanceKind, s.issuedOn)
        : null;
      const keepTyped = s.expiresOn && s.expiresOn !== previous;
      return {
        ...s,
        clearanceKind: kind,
        issuedOn: issued,
        expiresOn: keepTyped ? s.expiresOn : (suggestion ?? ""),
      };
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseInput(WorkerCheckForm, v);
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
      const r = await saveWorkerCheckAction({
        ...(id ? { id } : {}),
        values: v,
      });
      if (!r.ok) {
        setErrors({ ...(r.fieldErrors ?? {}), form: [r.message] });
        return;
      }
      router.push(`/registers/worker-checks?saved=${r.id}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6">
      <ErrorSummary errors={errors} labels={LABELS} />
      <RegisterParticipantLine />
      <RefField
        id="workerRef"
        label={LABELS.workerRef}
        hint="W-003"
        errors={errorsFor(errors, "workerRef")}
        value={v.workerRef}
        onChange={(x) => set("workerRef", x)}
        optional={false}
      />
      <Field
        id="roleLabel"
        label={LABELS.roleLabel}
        help="The role, never the person: support worker, director, coordinator."
        errors={errorsFor(errors, "roleLabel")}
      >
        {(describedBy, invalid) => (
          <TextInput
            id="roleLabel"
            name="roleLabel"
            value={v.roleLabel}
            onChange={(x) => set("roleLabel", x)}
            describedBy={describedBy}
            invalid={invalid}
            maxLength={TEXT_CAPS.roleLabel}
          />
        )}
      </Field>
      <SelectField
        id="clearanceKind"
        label={LABELS.clearanceKind}
        errors={errorsFor(errors, "clearanceKind")}
        value={v.clearanceKind}
        onChange={(x) =>
          onKindOrIssued(
            x as WorkerCheckFormValues["clearanceKind"],
            v.issuedOn,
          )
        }
        options={CLEARANCE_KINDS.map((k) => ({
          value: k,
          label: CLEARANCE_LABELS[k],
        }))}
      />
      {/* Batch 45 item 22: the check number the Worker Screening Rules s 18(3)(d) want on the list; optional, never a name. */}
      <Field
        id="clearanceNumber"
        label={`${LABELS.clearanceNumber} (optional)`}
        help="The NDIS worker screening check number, or the application number while it is pending. Never a name or a participant number."
        errors={errorsFor(errors, "clearanceNumber")}
      >
        {(describedBy, invalid) => (
          <TextInput
            id="clearanceNumber"
            name="clearanceNumber"
            value={v.clearanceNumber ?? ""}
            onChange={(x) => set("clearanceNumber", x)}
            describedBy={describedBy}
            invalid={invalid}
            maxLength={40}
          />
        )}
      </Field>
      {/* REQ-024 A1 (D-2419, finding 157): the application number from the unit's notice; with it a pending application is a row with no issue date. */}
      <Field
        id="applicationNumber"
        label={`${CLEARANCE_COLUMNS.application_number} (optional)`}
        help="From the screening unit's written notice. Leave the issue date blank while the application is pending; the row then reads 'pending'."
        errors={errorsFor(errors, "applicationNumber")}
      >
        {(describedBy, invalid) => (
          <TextInput
            id="applicationNumber"
            name="applicationNumber"
            value={v.applicationNumber ?? ""}
            onChange={(x) => set("applicationNumber", x)}
            describedBy={describedBy}
            invalid={invalid}
            maxLength={40}
          />
        )}
      </Field>
      <DateField
        id="issuedOn"
        label={LABELS.issuedOn}
        help="Blank while the application is pending."
        errors={errorsFor(errors, "issuedOn")}
        value={v.issuedOn ?? ""}
        onChange={(x) => onKindOrIssued(v.clearanceKind, x)}
        optional
      />
      <DateField
        id="expiresOn"
        label={LABELS.expiresOn}
        help="Leave blank for a check that does not expire."
        errors={errorsFor(errors, "expiresOn")}
        value={v.expiresOn ?? ""}
        onChange={(x) => set("expiresOn", x)}
        optional
      />
      {/* REQ-024 A1 (s 15(4); finding 151): the day the owner checked the row in the NDIS Worker Screening Database; the owner's alone, never the worker's. */}
      <DateField
        id="verifiedInDatabaseOn"
        label={CLEARANCE_COLUMNS.verified_in_database_on}
        help="For the NDIS Worker Screening Check: the day you looked the worker up in the database and saw 'Eligible to work'. The worker's list reads this date."
        errors={errorsFor(errors, "verifiedInDatabaseOn")}
        value={v.verifiedInDatabaseOn ?? ""}
        onChange={(x) => set("verifiedInDatabaseOn", x)}
        optional
      />
      <SelectField
        id="state"
        label={`${LABELS.state} (optional)`}
        errors={errorsFor(errors, "state")}
        value={v.state ?? ""}
        onChange={(x) => set("state", x as WorkerCheckFormValues["state"])}
        options={AU_STATES.map((s) => ({ value: s, label: s }))}
        placeholder="Not set"
      />
      <SafeTextArea
        id="note"
        label={LABELS.note}
        errors={errorsFor(errors, "note")}
        value={v.note ?? ""}
        onChange={(x) => set("note", x)}
        maxLength={TEXT_CAPS.note}
        rows={2}
        optional
      />
      <FormButtons
        pending={pending}
        label={id ? "Save changes" : "Add the check"}
        cancelHref="/registers/worker-checks"
      />
    </form>
  );
}
