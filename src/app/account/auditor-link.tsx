"use client";
import { useActionState } from "react";
import {
  createAuditorLinkAction,
  revokeAuditorLinkAction,
} from "@/server/registers/auditor-link-actions";

/**
 * The owner's auditor link panel (REQ-020 FR-2, FR-3): create one link for
 * 24, 48 or 72 hours (72 the default), see the one that is live with its
 * expiry and last open, revoke it. The link is shown once, here, for the
 * owner to copy and send themselves; Readyline sends it to no one and
 * names no auditor. Plain form posts; no pre-ticked anything.
 */
export function AuditorLinkPanel({
  current,
}: {
  current: {
    id: string;
    expiresAt: string;
    lastOpenedAt: string | null;
    openedCount: number;
  } | null;
}) {
  const [created, create, creating] = useActionState(
    createAuditorLinkAction,
    null,
  );
  const [revoked, revoke, revoking] = useActionState(
    revokeAuditorLinkAction,
    null,
  );
  const when = (iso: string) =>
    new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Sydney",
      day: "numeric",
      month: "long",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  // Live unless the link the server shows is the one this panel just revoked;
  // the create and revoke actions revalidate the page, so `current` follows them.
  const live =
    current &&
    !(revoked && revoked.ok && "id" in revoked && revoked.id === current.id);
  return (
    <div data-testid="auditor-link-panel">
      {created && created.ok && "url" in created ? (
        <div className="mt-3 rounded-md border border-zinc-300 p-3 dark:border-zinc-700">
          <p className="text-sm leading-6">
            Your link, shown once. Copy it and send it to your auditor yourself;
            it expires on {when(created.expiresAt)}.
          </p>
          <input
            readOnly
            value={created.url}
            aria-label="Auditor link"
            className="mt-2 block w-full rounded-md border border-zinc-400 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            data-testid="auditor-link-url"
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      ) : null}
      {live ? (
        <form action={revoke} className="mt-3">
          <input type="hidden" name="id" value={current.id} />
          <p className="text-sm leading-6" data-testid="auditor-link-state">
            A link is live until {when(current.expiresAt)};{" "}
            {current.lastOpenedAt
              ? `opened ${current.openedCount} ${current.openedCount === 1 ? "time" : "times"}, last on ${when(current.lastOpenedAt)}.`
              : "not opened yet."}
          </p>
          <button
            type="submit"
            disabled={revoking}
            aria-busy={revoking || undefined}
            className="btn-secondary mt-2"
            data-testid="auditor-link-revoke"
          >
            {revoking ? "Revoking…" : "Revoke this link now"}
          </button>
        </form>
      ) : null}
      <form action={create} className="mt-3">
        <label htmlFor="auditor-hours" className="block text-sm font-medium">
          How long the link should work
        </label>
        <select
          id="auditor-hours"
          name="hours"
          defaultValue="72"
          className="mt-1 rounded-md border border-zinc-400 px-3 py-2 text-base dark:border-zinc-600 dark:bg-zinc-900"
        >
          <option value="24">24 hours</option>
          <option value="48">48 hours</option>
          <option value="72">72 hours</option>
        </select>
        <button
          type="submit"
          disabled={creating}
          aria-busy={creating || undefined}
          className="btn-primary ml-3"
          data-testid="auditor-link-create"
        >
          {creating
            ? "Creating…"
            : live
              ? "Replace it with a new link"
              : "Create an auditor link"}
        </button>
        {created && !created.ok ? (
          <p role="alert" className="mt-3 text-sm leading-6">
            {created.message}
          </p>
        ) : null}
        {revoked && !revoked.ok ? (
          <p role="alert" className="mt-3 text-sm leading-6">
            {revoked.message}
          </p>
        ) : null}
      </form>
    </div>
  );
}
