"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ErrorSummary,
  Field,
  NumberInput,
  TextInput,
  errorsFor,
  type FieldErrors,
} from "@/app/start/_components/fields";
import {
  PolicyReviewForm,
  type PolicyReviewFormValues,
} from "@/lib/registers/forms";
import { TEXT_CAPS } from "@/lib/registers/types";
import { parseInput } from "@/lib/validation";
import { savePolicyReviewAction } from "@/server/registers/actions";
import {
  DateField,
  FormButtons,
  RefField,
  SafeTextArea,
  SelectField,
} from "./inputs";

const LABELS: Record<string, string> = {
  documentTypeId: "Document",
  title: "Title",
  adoptedOn: "Date adopted",
  reviewCycleMonths: "Months between reviews",
  lastReviewedOn: "Date last reviewed",
  reviewerRef: "Reviewer code",
  note: "Note",
  form: "Policy review",
};

export function PolicyReviewFormView({
  id,
  initial,
  documentOptions,
}: {
  id?: string;
  initial?: PolicyReviewFormValues;
  /** The catalogue: id and title of every document type, plus "other". */
  documentOptions: readonly { value: string; label: string }[];
}) {
  const router = useRouter();
  const [v, setV] = useState<PolicyReviewFormValues>(
    initial ?? {
      documentTypeId: "",
      title: "",
      adoptedOn: "",
      reviewCycleMonths: "12",
      lastReviewedOn: "",
      reviewerRef: "",
      note: "",
    },
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  const set = <K extends keyof PolicyReviewFormValues>(
    k: K,
    value: PolicyReviewFormValues[K],
  ) => setV((s) => ({ ...s, [k]: value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseInput(PolicyReviewForm, v);
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
      const r = await savePolicyReviewAction({
        ...(id ? { id } : {}),
        values: v,
      });
      if (!r.ok) {
        setErrors({ ...(r.fieldErrors ?? {}), form: [r.message] });
        return;
      }
      router.push(`/registers/policy-reviews?saved=${r.id}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6">
      <ErrorSummary errors={errors} labels={LABELS} />
      <SelectField
        id="documentTypeId"
        label={LABELS.documentTypeId}
        errors={errorsFor(errors, "documentTypeId")}
        value={v.documentTypeId}
        onChange={(x) => set("documentTypeId", x)}
        options={documentOptions}
      />
      {v.documentTypeId === "other" ? (
        <Field
          id="title"
          label={LABELS.title}
          errors={errorsFor(errors, "title")}
        >
          {(describedBy, invalid) => (
            <TextInput
              id="title"
              name="title"
              value={v.title ?? ""}
              onChange={(x) => set("title", x)}
              describedBy={describedBy}
              invalid={invalid}
              maxLength={TEXT_CAPS.title}
            />
          )}
        </Field>
      ) : null}
      <DateField
        id="adoptedOn"
        label={LABELS.adoptedOn}
        help="Leave blank until you have reviewed and adopted it."
        errors={errorsFor(errors, "adoptedOn")}
        value={v.adoptedOn ?? ""}
        onChange={(x) => set("adoptedOn", x)}
        optional
      />
      <Field
        id="reviewCycleMonths"
        label={LABELS.reviewCycleMonths}
        help="12 for most policies; 3 for registers."
        errors={errorsFor(errors, "reviewCycleMonths")}
      >
        {(describedBy, invalid) => (
          <NumberInput
            id="reviewCycleMonths"
            name="reviewCycleMonths"
            value={String(v.reviewCycleMonths ?? "")}
            onChange={(x) => set("reviewCycleMonths", x)}
            describedBy={describedBy}
            invalid={invalid}
            min={1}
            max={36}
          />
        )}
      </Field>
      <DateField
        id="lastReviewedOn"
        label={LABELS.lastReviewedOn}
        errors={errorsFor(errors, "lastReviewedOn")}
        value={v.lastReviewedOn ?? ""}
        onChange={(x) => set("lastReviewedOn", x)}
        optional
      />
      <RefField
        id="reviewerRef"
        label={LABELS.reviewerRef}
        hint="W-001"
        errors={errorsFor(errors, "reviewerRef")}
        value={v.reviewerRef ?? ""}
        onChange={(x) => set("reviewerRef", x)}
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
        label={id ? "Save changes" : "Add the policy"}
        cancelHref="/registers/policy-reviews"
      />
    </form>
  );
}
