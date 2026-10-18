"use client";
import { useState } from "react";
import {
  requestMagicLink,
  type RequestMagicLinkResponse,
} from "@/server/auth/actions";
import {
  ErrorSummary,
  Field,
  TextInput,
  errorsFor,
  type FieldErrors,
} from "../start/_components/fields";

export function SignInForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [done, setDone] = useState<RequestMagicLinkResponse | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await requestMagicLink({ email, ...(next ? { next } : {}) });
      if (!r.ok) {
        setErrors({
          ...r.fieldErrors,
          ...(r.formErrors.length ? { form: r.formErrors } : {}),
        });
        setDone(null);
      } else {
        setErrors({});
        setDone(r);
      }
    } finally {
      setBusy(false);
    }
  }

  if (done?.ok) {
    return (
      <p
        role="status"
        className="border-rule mt-6 rounded-md border p-4 leading-7"
        data-testid="magic-link-sent"
      >
        {done.message}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6">
      <ErrorSummary
        errors={errors}
        labels={{ email: "Email", form: "Sign-in" }}
      />
      <Field
        id="email"
        label="Email address"
        errors={errorsFor(errors, "email")}
      >
        {(describedBy, invalid) => (
          // QA live b340ee3 (report B; PO 12:08): an email field, so a phone opens the email keyboard,
          // on the shared control now that TextInput takes a type; the form stays noValidate, so the
          // server's words answer.
          <TextInput
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={254}
            value={email}
            onChange={setEmail}
            describedBy={describedBy}
            invalid={invalid}
          />
        )}
      </Field>
      <button type="submit" disabled={busy} className="btn-primary">
        {busy ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
