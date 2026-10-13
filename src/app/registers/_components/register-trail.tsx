"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AuditDaySlug } from "@/lib/registers/audit-day-forms";
import type { RegisterEventRow } from "@/lib/registers/audit-day-types";
import {
  addRegisterNoteAction,
  markReviewedAction,
} from "@/server/registers/audit-day-actions";
import { DateField, SafeTextArea } from "./inputs";

/**
 * The shared append-only trail under an audit-day register row (REQ-018,
 * D-1902): created, updated, notes, reviews, oldest first, plus "Add a
 * note" and, on a row with a review date, "Reviewed today" with the next
 * date. Nothing here can be edited or deleted by a member.
 */
const KIND_LABEL: Record<string, string> = {
  created: "Recorded",
  updated: "Changed",
  note: "Note",
  reviewed: "Reviewed",
  closed: "Completed",
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

export function RegisterTrail({
  slug,
  rowId,
  events,
  canWrite,
  reviewable,
}: {
  slug: AuditDaySlug;
  rowId: string;
  events: RegisterEventRow[];
  canWrite: boolean;
  /** True for a row with a review date: offers "Reviewed today, next review on". */
  reviewable: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"closed" | "note" | "review">("closed");
  const [note, setNote] = useState("");
  const [nextReview, setNextReview] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  async function submitNote(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setErrors([]);
    try {
      const r = await addRegisterNoteAction({
        register: slug,
        id: rowId,
        kind: "note",
        note,
      });
      if (!r.ok) {
        setErrors([...(r.fieldErrors?.note ?? []), r.message]);
        return;
      }
      setNote("");
      setMode("closed");
      setSaved("Note added.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setErrors([]);
    try {
      const r = await markReviewedAction({
        register: slug,
        id: rowId,
        review_on: nextReview,
      });
      if (!r.ok) {
        setErrors([...(r.fieldErrors?.review_on ?? []), r.message]);
        return;
      }
      setMode("closed");
      setSaved("Reviewed. The next review date is set.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-labelledby="trail-heading"
      className="mt-8"
      data-testid="register-trail"
    >
      <h2 id="trail-heading" className="text-lg font-semibold">
        What has happened since ({events.length})
      </h2>
      <ol className="mt-2 divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
        {events.map((ev) => (
          <li key={ev.id} className="py-2">
            <span className="text-zinc-600 dark:text-zinc-400">
              {when(ev.at)}
            </span>{" "}
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
          ✓ {saved}
        </p>
      ) : null}
      {canWrite && mode === "note" ? (
        <form onSubmit={submitNote} noValidate className="mt-3">
          <SafeTextArea
            id="trail-note"
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
              data-testid="trail-note-submit"
            >
              {pending ? "Saving…" : "Add the note"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setMode("closed")}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      {canWrite && mode === "review" ? (
        <form onSubmit={submitReview} noValidate className="mt-3">
          <DateField
            id="next-review"
            label="Next review date"
            help="Today counts as reviewed; this is when you look at it again."
            errors={errors}
            value={nextReview}
            onChange={setNextReview}
          />
          <div className="flex gap-3">
            <button
              type="submit"
              className="btn-primary"
              disabled={pending}
              aria-busy={pending || undefined}
              data-testid="trail-review-submit"
            >
              {pending ? "Saving…" : "Mark as reviewed"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setMode("closed")}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      {canWrite && mode === "closed" ? (
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setSaved(null);
              setMode("note");
            }}
            data-testid="trail-add-note"
          >
            Add a note
          </button>
          {reviewable ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setSaved(null);
                setMode("review");
              }}
              data-testid="trail-reviewed"
            >
              Reviewed today
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
