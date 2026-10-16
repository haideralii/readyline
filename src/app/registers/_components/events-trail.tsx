"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  ComplaintEventRow,
  IncidentEventRow,
} from "@/lib/registers/types";
import {
  addComplaintNoteAction,
  addIncidentNoteAction,
} from "@/server/registers/actions";
import { SafeTextArea } from "./inputs";

/**
 * The append-only trail under an incident or complaint (REQ-009 FR-5):
 * creation, notes, status changes and notifications, oldest first, plus
 * "Add a note". Nothing here can be edited or deleted by a member.
 */
const KIND_LABEL: Record<string, string> = {
  created: "Recorded",
  note: "Note",
  "status-change": "Status changed",
  "reportable-flagged": "Marked reportable",
  notified: "Commission notified",
  acknowledged: "Acknowledged",
  resolved: "Resolved",
};

function when(iso: string) {
  return new Date(iso).toLocaleString("en-AU", {
    timeZone: "Australia/Sydney",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function EventsTrail({
  kind,
  subjectId,
  events,
  canWrite,
}: {
  kind: "incident" | "complaint";
  subjectId: string;
  events: (IncidentEventRow | ComplaintEventRow)[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setErrors([]);
    try {
      const action =
        kind === "incident" ? addIncidentNoteAction : addComplaintNoteAction;
      const r = await action({ id: subjectId, note });
      if (!r.ok) {
        setErrors([
          ...(r.fieldErrors?.note ?? []),
          ...(r.fieldErrors?.note?.length ? [] : [r.message]),
        ]);
        return;
      }
      setNote("");
      setOpen(false);
      setSaved(true);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-labelledby="trail-heading"
      className="mt-8"
      data-testid="events-trail"
    >
      <h2 id="trail-heading" className="text-lg font-semibold">
        What has happened since ({events.length})
      </h2>
      <ol
        className="divide-rule mt-2 divide-y text-sm"
        aria-labelledby="trail-heading"
      >
        {events.map((ev) => (
          <li key={ev.id} className="py-2">
            <span className="text-slate">{when(ev.at)}</span>{" "}
            <span className="font-medium">
              {KIND_LABEL[ev.kind] ?? ev.kind}
            </span>
            {ev.note ? (
              <span className="block leading-6">{ev.note}</span>
            ) : null}
          </li>
        ))}
      </ol>
      {saved ? (
        <p role="status" className="text-moss mt-2 text-sm">
          ✓ Note added.
        </p>
      ) : null}
      {canWrite ? (
        open ? (
          <form onSubmit={onSubmit} noValidate className="mt-3">
            <SafeTextArea
              id="event-note"
              label="Note"
              errors={errors}
              value={note}
              onChange={setNote}
              maxLength={1000}
              rows={3}
            />
            <div className="flex gap-3">
              <button
                type="submit"
                className="btn-primary"
                disabled={pending}
                aria-busy={pending || undefined}
                data-testid="note-submit"
              >
                {pending ? "Saving…" : "Add the note"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="btn-secondary mt-3"
            onClick={() => {
              setSaved(false);
              setOpen(true);
            }}
            data-testid="add-note"
          >
            Add a note
          </button>
        )
      ) : null}
    </section>
  );
}
