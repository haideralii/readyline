"use client";
import Link from "next/link";
import { useState } from "react";
import {
  SELF_CHECK_QUESTIONS,
  walkSummary,
  type SelfCheckAnswers,
} from "@/lib/registers/self-check";
import { finishSelfCheckAction } from "@/server/registers/self-check-actions";

export type WalkRecord = {
  id: string;
  name: string;
  /** The live state in the customer's words, from the audit-day list. */
  word: string;
  state: "filled" | "missing" | "overdue";
  href: string;
};

/**
 * One screen per record (REQ-020 FR-9; REQ-017's one-step rule): the
 * record's live state, one plain question, Yes or No, an optional note,
 * then the next; the last screen is the count of findings and the next
 * date. Nothing is saved until the walk ends.
 */
export function CheckWalk({
  records,
  today,
}: {
  records: WalkRecord[];
  today: string;
}) {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<SelfCheckAnswers>({});
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<{ findings: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const total = records.length;
  const current = records[i];

  async function answer(value: "yes" | "no") {
    const next = {
      ...answers,
      [current.id]: { answer: value, note: note.trim() },
    };
    setAnswers(next);
    setNote("");
    if (i + 1 < total) {
      setI(i + 1);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const r = await finishSelfCheckAction({
        walkedOn: today,
        walkedByRef: "owner",
        answers: next,
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setDone({ findings: r.findings });
    } catch {
      setError(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  if (done)
    return (
      <div className="mt-6" data-testid="check-done">
        <p className="text-lg leading-8" data-testid="check-summary">
          {walkSummary(done.findings, today)}
        </p>
        <p className="mt-4">
          <Link
            href="/path/audit-day"
            className="btn-primary"
            data-testid="check-back"
          >
            Back to the audit day
          </Link>
        </p>
        {done.findings > 0 ? (
          <p className="mt-3 text-sm">
            <Link
              href="/registers/improvements"
              className="underline underline-offset-4"
            >
              Open the improvement register
            </Link>
          </p>
        ) : null}
      </div>
    );

  return (
    <div className="mt-6" data-testid="check-walk">
      <p
        className="text-slate text-sm font-medium"
        data-testid="check-progress"
      >
        {i + 1} of {total}
      </p>
      <h2 className="mt-1 text-xl font-semibold" data-testid="check-record">
        {current.name}
      </h2>
      <p
        className="mt-1 text-sm leading-6"
        data-testid="check-state"
        data-state={current.state}
      >
        {current.word}{" "}
        <Link
          href={current.href}
          className="underline underline-offset-4"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open it
        </Link>
      </p>
      <p className="mt-4 text-lg leading-8" data-testid="check-question">
        {SELF_CHECK_QUESTIONS[current.id]}
      </p>
      <label htmlFor="check-note" className="mt-4 block text-sm font-medium">
        A note (optional; codes, never names)
      </label>
      <textarea
        id="check-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={300}
        rows={2}
        className="border-line mt-1 block w-full rounded-md border px-3 py-2 text-base"
      />
      {error ? (
        <p role="alert" className="mt-3 text-sm leading-6">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          className="btn-primary"
          disabled={pending}
          aria-busy={pending || undefined}
          onClick={() => void answer("yes")}
          data-testid="check-yes"
        >
          Yes
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={pending}
          onClick={() => void answer("no")}
          data-testid="check-no"
        >
          No
        </button>
      </div>
    </div>
  );
}
