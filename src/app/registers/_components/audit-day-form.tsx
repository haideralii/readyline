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
  blankValues,
  metaFor,
  type AuditDaySlug,
  type FieldSpec,
} from "@/lib/registers/audit-day-forms";
import { parseInput } from "@/lib/validation";
import { saveAuditDayRowAction } from "@/server/registers/audit-day-actions";
import {
  CheckboxField,
  DateField,
  FormButtons,
  RefField,
  SafeTextArea,
  SelectField,
} from "./inputs";

/**
 * One form for the nine audit-day registers (REQ-018 Session B; D-1904):
 * the fields come from the register's spec, the values are validated with
 * its schema on the client for instant messages and again in the action,
 * and every control is the REQ-009 input with the same minimum sizes.
 */
export function AuditDayForm({
  slug,
  id,
  initial,
  cancelHref,
}: {
  slug: AuditDaySlug;
  id?: string;
  initial?: Record<string, string | boolean>;
  cancelHref: string;
}) {
  const meta = metaFor(slug)!;
  const router = useRouter();
  const [v, setV] = useState<Record<string, string | boolean>>(
    initial ?? blankValues(meta.fields),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  const labels: Record<string, string> = Object.fromEntries(
    meta.fields.map((f) => [f.name, f.label]),
  );
  labels.form = meta.title;
  const set = (name: string, value: string | boolean) =>
    setV((s) => ({ ...s, [name]: value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseInput(meta.schema, v);
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
      const r = await saveAuditDayRowAction({
        register: slug,
        ...(id ? { id } : {}),
        values: v,
      });
      if (!r.ok) {
        setErrors({ ...(r.fieldErrors ?? {}), form: [r.message] });
        return;
      }
      router.push(`/registers/${slug}?saved=${r.id}`);
    } finally {
      setPending(false);
    }
  }

  const control = (f: FieldSpec) => {
    const value = v[f.name];
    const errs = errorsFor(errors, f.name);
    const label = f.optional ? `${f.label} (optional)` : f.label;
    switch (f.kind) {
      case "date":
        return (
          <DateField
            key={f.name}
            id={f.name}
            label={f.label}
            help={f.help}
            errors={errs}
            value={String(value ?? "")}
            onChange={(x) => set(f.name, x)}
            optional={f.optional}
          />
        );
      case "ref":
        return (
          <RefField
            key={f.name}
            id={f.name}
            label={f.label}
            hint={f.hint ?? ""}
            errors={errs}
            value={String(value ?? "")}
            onChange={(x) => set(f.name, x)}
            optional={f.optional ?? false}
          />
        );
      case "select":
        return (
          <SelectField
            key={f.name}
            id={f.name}
            label={label}
            errors={errs}
            value={String(value ?? "")}
            onChange={(x) => set(f.name, x)}
            options={f.options ?? []}
            placeholder={f.optional ? "Not set" : undefined}
          />
        );
      case "checkbox":
        return (
          <CheckboxField
            key={f.name}
            id={f.name}
            label={f.label}
            help={f.help}
            checked={Boolean(value)}
            onChange={(x) => set(f.name, x)}
          />
        );
      case "textarea":
        return (
          <SafeTextArea
            key={f.name}
            id={f.name}
            label={f.label}
            help={f.help}
            errors={errs}
            value={String(value ?? "")}
            onChange={(x) => set(f.name, x)}
            maxLength={f.maxLength ?? 500}
            rows={f.rows ?? 3}
            optional={f.optional}
          />
        );
      default:
        return (
          <Field
            key={f.name}
            id={f.name}
            label={label}
            help={f.help}
            errors={errs}
          >
            {(describedBy, invalid) => (
              <TextInput
                id={f.name}
                name={f.name}
                value={String(value ?? "")}
                onChange={(x) => set(f.name, x)}
                describedBy={describedBy}
                invalid={invalid}
                maxLength={f.maxLength ?? 120}
              />
            )}
          </Field>
        );
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="mt-6"
      data-testid={`audit-day-form-${slug}`}
    >
      <ErrorSummary errors={errors} labels={labels} />
      {meta.fields.map(control)}
      <FormButtons
        pending={pending}
        label={id ? "Save changes" : meta.addLabel}
        cancelHref={cancelHref}
      />
    </form>
  );
}
