"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ErrorSummary,
  errorsFor,
  type FieldErrors,
} from "@/app/start/_components/fields";
import { ComplaintForm, type ComplaintFormValues } from "@/lib/registers/forms";
import {
  CHANNEL_LABELS,
  COMPLAINT_STATUS_LABELS,
} from "@/lib/registers/labels";
import {
  COMPLAINT_CHANNELS,
  COMPLAINT_STATUSES,
  TEXT_CAPS,
} from "@/lib/registers/types";
import { parseInput } from "@/lib/validation";
import { saveComplaintAction } from "@/server/registers/actions";
import {
  DateField,
  FormButtons,
  RefField,
  SafeTextArea,
  SelectField,
} from "./inputs";

const LABELS: Record<string, string> = {
  receivedOn: "Date received",
  channel: "How it arrived",
  fromRef: "Who raised it (code)",
  summary: "The complaint, in a sentence or two",
  outcome: "What you did and the outcome",
  acknowledgedOn: "Date acknowledged",
  resolvedOn: "Date resolved",
  status: "Status",
  form: "Complaint",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function ComplaintFormView({
  id,
  initial,
}: {
  id?: string;
  initial?: ComplaintFormValues;
}) {
  const router = useRouter();
  const [v, setV] = useState<ComplaintFormValues>(
    initial ?? {
      receivedOn: today(),
      channel: "" as ComplaintFormValues["channel"],
      fromRef: "",
      summary: "",
      outcome: "",
      acknowledgedOn: "",
      resolvedOn: "",
      status: "received",
    },
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  const set = <K extends keyof ComplaintFormValues>(
    k: K,
    value: ComplaintFormValues[K],
  ) => setV((s) => ({ ...s, [k]: value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseInput(ComplaintForm, v);
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
      const r = await saveComplaintAction({ ...(id ? { id } : {}), values: v });
      if (!r.ok) {
        setErrors({ ...(r.fieldErrors ?? {}), form: [r.message] });
        return;
      }
      router.push(`/registers/complaints/${r.id}?saved=1`);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6">
      <ErrorSummary errors={errors} labels={LABELS} />
      <DateField
        id="receivedOn"
        label={LABELS.receivedOn}
        errors={errorsFor(errors, "receivedOn")}
        value={v.receivedOn}
        onChange={(x) => set("receivedOn", x)}
      />
      <SelectField
        id="channel"
        label={LABELS.channel}
        errors={errorsFor(errors, "channel")}
        value={v.channel}
        onChange={(x) => set("channel", x as ComplaintFormValues["channel"])}
        options={COMPLAINT_CHANNELS.map((c) => ({
          value: c,
          label: CHANNEL_LABELS[c],
        }))}
      />
      <RefField
        id="fromRef"
        label={LABELS.fromRef}
        hint="P-014, FAM-2, ADV-1, W-003 or OTH-1"
        errors={errorsFor(errors, "fromRef")}
        value={v.fromRef ?? ""}
        onChange={(x) => set("fromRef", x)}
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
        id="outcome"
        label={LABELS.outcome}
        errors={errorsFor(errors, "outcome")}
        value={v.outcome ?? ""}
        onChange={(x) => set("outcome", x)}
        maxLength={TEXT_CAPS.outcome}
        rows={4}
        optional
      />
      <DateField
        id="acknowledgedOn"
        label={LABELS.acknowledgedOn}
        errors={errorsFor(errors, "acknowledgedOn")}
        value={v.acknowledgedOn ?? ""}
        onChange={(x) => set("acknowledgedOn", x)}
        optional
      />
      <SelectField
        id="status"
        label={LABELS.status}
        errors={errorsFor(errors, "status")}
        value={v.status ?? "received"}
        onChange={(x) =>
          set("status", (x || "received") as ComplaintFormValues["status"])
        }
        options={COMPLAINT_STATUSES.map((s) => ({
          value: s,
          label: COMPLAINT_STATUS_LABELS[s],
        }))}
        placeholder="Received"
      />
      {v.status === "resolved" || v.resolvedOn ? (
        <DateField
          id="resolvedOn"
          label={LABELS.resolvedOn}
          errors={errorsFor(errors, "resolvedOn")}
          value={v.resolvedOn ?? ""}
          onChange={(x) => set("resolvedOn", x)}
        />
      ) : null}
      <FormButtons
        pending={pending}
        label={id ? "Save changes" : "Add the complaint"}
        cancelHref={
          id ? `/registers/complaints/${id}` : "/registers/complaints"
        }
      />
    </form>
  );
}
