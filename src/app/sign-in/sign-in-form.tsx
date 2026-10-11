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
        className="mt-6 rounded-md border border-zinc-300 p-4 leading-7 dark:border-zinc-700"
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
          <TextInput
            id="email"
            name="email"
            value={email}
            onChange={setEmail}
            describedBy={describedBy}
            invalid={invalid}
            autoComplete="email"
            inputMode="text"
            maxLength={254}
          />
        )}
      </Field>
      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-12 items-center justify-center rounded-md bg-zinc-900 px-5 text-base font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {busy ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
