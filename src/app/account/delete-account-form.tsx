"use client";
import { useState } from "react";
import { deleteAccountAction } from "@/server/accounts/actions";

export function DeleteAccountForm({ tradingName }: { tradingName: string }) {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      const r = await deleteAccountAction();
      if (r && !r.ok)
        setError(r.formErrors[0] ?? "We could not delete your account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-3"
      data-testid="delete-account-form"
    >
      <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        Deleting hides everything in the account at once, signs you out
        everywhere, and permanently removes the data after 30 days. Export your
        data first if you want a copy.
      </p>
      <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="h-5 w-5"
        />
        <span className="text-sm">
          I understand this deletes the account for {tradingName}.
        </span>
      </label>
      {error ? (
        <p
          role="alert"
          className="mt-2 text-sm font-medium text-red-700 dark:text-red-400"
        >
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={!confirmed || busy}
        className="mt-3 inline-flex min-h-12 items-center justify-center rounded-md border border-red-700 px-5 text-base font-medium text-red-800 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 dark:border-red-400 dark:text-red-300 dark:hover:bg-red-950"
      >
        {busy ? "Deleting…" : "Delete my account"}
      </button>
    </form>
  );
}
