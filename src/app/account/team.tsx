"use client";
import { useActionState } from "react";
import { INVITE_LINE } from "@/lib/registers/worker";
import {
  createReportLinkAction,
  inviteWorkerAction,
  removeWorkerAction,
  revokeInvitationAction,
  revokeReportLinkAction,
} from "@/server/registers/team-actions";

/**
 * The owner's team panel (REQ-020 FR-4, FR-5, FR-11): invite a worker by
 * email with their code (the invitation is emailed and the link shown once
 * here too), the invitations still open by code, the workers with one
 * Remove each, and the report link: on, regenerate, off, with the link
 * shown once. Plain form posts, no pre-ticked anything; addresses are
 * never shown back (the row keeps only a hash).
 */
export function TeamPanel({
  invitations,
  workers,
  reportLink,
}: {
  invitations: { id: string; workerRef: string; expiresAt: string }[];
  workers: { userId: string; workerRef: string | null; since: string }[];
  reportLink: { id: string; createdAt: string } | null;
}) {
  const [invited, invite, inviting] = useActionState(inviteWorkerAction, null);
  const [revokedInvite, revokeInvite, revokingInvite] = useActionState(
    revokeInvitationAction,
    null,
  );
  const [removed, remove, removing] = useActionState(removeWorkerAction, null);
  const [linked, createLink, linking] = useActionState(
    createReportLinkAction,
    null,
  );
  const [unlinked, revokeLink, unlinking] = useActionState(
    revokeReportLinkAction,
    null,
  );
  const when = (iso: string) =>
    new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Sydney",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  const linkLive = Boolean(
    (linked && linked.ok) || (reportLink && !(unlinked && unlinked.ok)),
  );
  const alert = (r: { ok: boolean; message?: string } | null) =>
    r && !r.ok && r.message ? (
      <p role="alert" className="mt-2 text-sm leading-6">
        {r.message}
      </p>
    ) : r && r.ok && r.message ? (
      <p role="status" className="mt-2 text-sm leading-6">
        {r.message}
      </p>
    ) : null;

  return (
    <div data-testid="team-panel">
      <h3 className="mt-4">Workers</h3>
      <p className="text-ink mt-1 text-sm leading-6">{INVITE_LINE}</p>
      {workers.length > 0 ? (
        <ul className="divide-rule mt-2 divide-y">
          {workers.map((w) => (
            <li
              key={w.userId}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
              data-testid="team-worker"
            >
              <span className="text-sm leading-6">
                Worker {w.workerRef ?? "(no code)"}, since {when(w.since)}
              </span>
              <form action={remove}>
                <input type="hidden" name="userId" value={w.userId} />
                <button
                  type="submit"
                  disabled={removing}
                  aria-busy={removing || undefined}
                  className="btn-secondary"
                  data-testid="team-worker-remove"
                >
                  Remove {w.workerRef ?? "this worker"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-slate mt-2 text-sm">No workers yet.</p>
      )}
      {alert(removed)}

      {invitations.length > 0 ? (
        <>
          <h3 className="mt-5">Invitations waiting</h3>
          <ul className="divide-rule mt-1 divide-y">
            {invitations.map((i) => (
              <li
                key={i.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
                data-testid="team-invitation"
              >
                <span className="text-sm leading-6">
                  Worker {i.workerRef}, until {when(i.expiresAt)}
                </span>
                <form action={revokeInvite}>
                  <input type="hidden" name="id" value={i.id} />
                  <button
                    type="submit"
                    disabled={revokingInvite}
                    aria-busy={revokingInvite || undefined}
                    className="btn-secondary"
                    data-testid="team-invitation-revoke"
                  >
                    Cancel the invitation for {i.workerRef}
                  </button>
                </form>
              </li>
            ))}
          </ul>
          {alert(revokedInvite)}
        </>
      ) : null}

      {invited && invited.ok && invited.url ? (
        <div
          className="border-rule mt-4 rounded-md border p-3"
          data-testid="team-invite-sent"
        >
          <p className="text-sm leading-6">
            Invitation sent. It works for 7 days. If the email does not arrive,
            copy this link and send it yourself; it is shown once.
          </p>
          <input
            readOnly
            value={invited.url}
            aria-label="Invitation link"
            className="border-line mt-2 block w-full rounded-md border px-3 py-2 text-sm"
            data-testid="team-invite-url"
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      ) : null}
      <form action={invite} className="mt-4" data-testid="team-invite-form">
        <h3 className="">Invite a worker</h3>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="invite-email" className="block text-sm font-medium">
              Their email address
            </label>
            <input
              id="invite-email"
              name="email"
              type="email"
              autoComplete="off"
              required
              className="border-line mt-1 block w-full rounded-md border px-3 py-2 text-base"
            />
          </div>
          <div>
            <label
              htmlFor="invite-worker-ref"
              className="block text-sm font-medium"
            >
              Their worker code
            </label>
            <input
              id="invite-worker-ref"
              name="workerRef"
              type="text"
              autoComplete="off"
              placeholder="W-003"
              required
              aria-describedby="invite-worker-ref-help"
              className="border-line mt-1 block w-full rounded-md border px-3 py-2 text-base"
            />
            <p id="invite-worker-ref-help" className="text-slate mt-1 text-sm">
              The same code as in your worker checks register, never a name.
            </p>
          </div>
        </div>
        <button
          type="submit"
          disabled={inviting}
          aria-busy={inviting || undefined}
          className="btn-primary mt-3"
          data-testid="team-invite-submit"
        >
          {inviting ? "Sending…" : "Send the invitation"}
        </button>
        {alert(invited)}
      </form>

      <h3 className="mt-8">Report link</h3>
      <p className="text-ink mt-1 text-sm leading-6">
        One link anyone on your team can open, signed out, to report an incident
        to you. Each report waits for you to confirm it. Turn it off at any
        time; regenerate it if it has been shared too widely.
      </p>
      {linked && linked.ok && linked.url ? (
        <div
          className="border-rule mt-3 rounded-md border p-3"
          data-testid="team-report-link-created"
        >
          <p className="text-sm leading-6">
            Your report link, shown once. Copy it and share it with your team
            yourself.
          </p>
          <input
            readOnly
            value={linked.url}
            aria-label="Report link"
            className="border-line mt-2 block w-full rounded-md border px-3 py-2 text-sm"
            data-testid="team-report-link-url"
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      ) : null}
      <p
        className="mt-2 text-sm leading-6"
        data-testid="team-report-link-state"
      >
        {linkLive
          ? `The report link is on${reportLink && !(linked && linked.ok) ? ` since ${when(reportLink.createdAt)}` : ""}.`
          : "The report link is off."}
      </p>
      <div className="mt-2 flex flex-wrap gap-3">
        <form action={createLink}>
          <button
            type="submit"
            disabled={linking}
            aria-busy={linking || undefined}
            className="btn-primary"
            data-testid="team-report-link-create"
          >
            {linking
              ? "Working…"
              : linkLive
                ? "Regenerate the report link"
                : "Turn the report link on"}
          </button>
        </form>
        {linkLive && reportLink ? (
          <form action={revokeLink}>
            <input type="hidden" name="id" value={reportLink.id} />
            <button
              type="submit"
              disabled={unlinking}
              aria-busy={unlinking || undefined}
              className="btn-secondary"
              data-testid="team-report-link-revoke"
            >
              Turn the report link off
            </button>
          </form>
        ) : null}
      </div>
      {alert(linked)}
      {alert(unlinked)}
    </div>
  );
}
