"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FindingRow } from "@/lib/registers/audit-day-types";
import {
  FINDING_ADDRESS_LABEL,
  FINDING_VERIFY_LABEL,
} from "@/lib/registers/findings";
import {
  addressFindingAction,
  verifyFindingAction,
} from "@/server/registers/findings-trail-actions";

const INPUT =
  "border-line bg-surface text-ink block w-full rounded-md border px-3 py-2 text-base shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2";

function today(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * REQ-033 FR-5, FR-7 (D-2935, D-2936): the two things the provider records
 * on a finding: that they addressed it (the day and the role), and that the
 * auditor verified the change (the date). No "resolve", "clear" or "pass".
 */
export function FindingActions({ row }: { row: FindingRow }) {
  const router = useRouter();
  const [addressedOn, setAddressedOn] = useState(today());
  const [role, setRole] = useState("Owner");
  const [verifiedOn, setVerifiedOn] = useState(today());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setBusy(true);
    setMessage(null);
    try {
      const r = await fn();
      if (!r.ok) {
        setMessage(r.message ?? "Something went wrong.");
        return;
      }
      router.refresh();
    } catch {
      setMessage(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (row.status === "verified") return null;
  return (
    <section
      className="mt-6"
      aria-labelledby="finding-record-heading"
      data-testid="finding-actions"
    >
      <h2 id="finding-record-heading" className="text-lg font-medium">
        {row.status === "open"
          ? "Record what you did"
          : "Record what the auditor said"}
      </h2>
      <p className="text-slate mt-1 text-sm leading-6">
        {row.status === "open"
          ? "Your record that the change is made. Your auditor decides whether the finding is closed."
          : "Your record of the auditor's word, with the date. It does not close the finding with the Commission; your auditor does that."}
      </p>
      {row.status === "open" ? (
        <form
          className="mt-3 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() =>
              addressFindingAction({ id: row.id, addressedOn, role }),
            );
          }}
          data-testid="finding-address-form"
        >
          <label className="block text-sm">
            <span className="font-medium">Date it was addressed</span>
            <input
              type="date"
              className={`${INPUT} mt-1`}
              value={addressedOn}
              onChange={(e) => setAddressedOn(e.target.value)}
              data-testid="finding-addressed-on"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Who addressed it (role)</span>
            <input
              type="text"
              className={`${INPUT} mt-1`}
              value={role}
              maxLength={80}
              onChange={(e) => setRole(e.target.value)}
              data-testid="finding-addressed-role"
              required
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="btn-primary"
              disabled={busy}
              data-testid="finding-address"
            >
              {busy ? "Saving…" : FINDING_ADDRESS_LABEL}
            </button>
          </div>
        </form>
      ) : (
        <form
          className="mt-3 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => verifyFindingAction({ id: row.id, verifiedOn }));
          }}
          data-testid="finding-verify-form"
        >
          <label className="block text-sm">
            <span className="font-medium">Date the auditor verified it</span>
            <input
              type="date"
              className={`${INPUT} mt-1`}
              value={verifiedOn}
              onChange={(e) => setVerifiedOn(e.target.value)}
              data-testid="finding-verified-on"
              required
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="btn-secondary"
              disabled={busy}
              data-testid="finding-verify"
            >
              {busy ? "Saving…" : FINDING_VERIFY_LABEL}
            </button>
          </div>
        </form>
      )}
      {message ? (
        <p
          role="alert"
          className="border-signal mt-3 rounded-md border p-3 text-sm leading-6"
          data-testid="finding-actions-message"
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}
