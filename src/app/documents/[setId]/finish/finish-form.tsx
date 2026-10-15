"use client";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { ParticipantDataWarning } from "@/app/start/_components/fields";
import type { FactQuestion } from "@/lib/generator/facts-fill";
import { finishPackAction, saveFactAction } from "@/server/path/actions";

/**
 * The Finish your pack form (REQ-017 FR-2, D-1702): one question per screen
 * on a phone with Back and Next only, the same questions grouped by topic
 * on a wider screen; an example under each field; the participant-data
 * warning once; every answer saved as it is given (FR-4: closing the phone
 * loses nothing); on the last screen the documents are re-rendered with the
 * answers filled in and the page says "Done. Your N documents are complete."
 */
const WIDE = "(min-width: 640px)";
function subscribeWide(onChange: () => void) {
  const q = window.matchMedia(WIDE);
  q.addEventListener("change", onChange);
  return () => q.removeEventListener("change", onChange);
}

const TOPIC_TITLES: Record<FactQuestion["topic"], string> = {
  people: "Who is responsible",
  contact: "How to reach them",
  dates: "Dates",
  business: "Your business",
  other: "Other details",
};

export function FinishForm({
  setId,
  questions,
  initial,
  documentCount,
}: {
  setId: string;
  questions: FactQuestion[];
  initial: Record<string, string>;
  documentCount: number;
}) {
  const router = useRouter();
  const wide = useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    () => false,
  );
  const [answers, setAnswers] = useState<Record<string, string>>(initial);
  const firstOpen = Math.max(
    0,
    questions.findIndex((q) => !(initial[q.key] ?? "").trim()),
  );
  const [index, setIndex] = useState(firstOpen);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  // A call that never comes back (the connection dropped, the server did
  // not answer) must not leave the button busy for good: the customer gets
  // the message and the button back, and can press it again (REQ-017: one
  // step at a time, never a dead end).
  const UNREACHABLE =
    "Could not reach the server. Check your connection and try again.";

  async function saveOne(q: FactQuestion): Promise<boolean> {
    const value = (answers[q.key] ?? "").trim();
    if (!value) {
      setMessage("Type an answer first. A few words are enough.");
      return false;
    }
    try {
      const r = await saveFactAction({ key: q.key, value });
      if (!r.ok) {
        setMessage(r.message);
        return false;
      }
      return true;
    } catch {
      setMessage(UNREACHABLE);
      return false;
    }
  }

  async function finish() {
    setBusy(true);
    setMessage(null);
    let r: Awaited<ReturnType<typeof finishPackAction>> | null = null;
    try {
      r = await finishPackAction({ setId });
    } catch {
      r = null;
    } finally {
      setBusy(false);
    }
    if (!r) {
      setMessage(UNREACHABLE);
      return;
    }
    if (!r.ok) {
      setMessage(r.message);
      return;
    }
    setDone(documentCount);
    router.refresh();
  }

  async function next(q: FactQuestion) {
    setBusy(true);
    setMessage(null);
    const ok = await saveOne(q);
    setBusy(false);
    if (!ok) return;
    if (index + 1 < questions.length) setIndex(index + 1);
    else await finish();
  }

  async function saveAll() {
    setBusy(true);
    setMessage(null);
    for (const q of questions) {
      const ok = await saveOne(q);
      if (!ok) {
        setBusy(false);
        return;
      }
    }
    await finish();
  }

  if (done !== null)
    return (
      <p
        role="status"
        className="mt-6 text-lg leading-8"
        data-testid="finish-done"
      >
        Done. Your {done} documents are complete.
      </p>
    );

  const field = (q: FactQuestion, autoFocus = false) => (
    <div key={q.key} className="mt-5" data-testid={`fact-${q.key}`}>
      <label htmlFor={`fact-${q.key}`} className="block text-lg font-medium">
        {q.question}
      </label>
      <p
        id={`fact-${q.key}-help`}
        className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400"
      >
        {q.example}
      </p>
      <input
        id={`fact-${q.key}`}
        name={q.key}
        type="text"
        inputMode={q.kind === "date" ? "text" : "text"}
        autoComplete={
          q.key === "name" ? "name" : q.key === "phone-or-email" ? "tel" : "off"
        }
        autoFocus={autoFocus}
        maxLength={200}
        value={answers[q.key] ?? ""}
        aria-describedby={`fact-${q.key}-help`}
        onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
        className="mt-2 block w-full rounded-md border border-zinc-400 px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-zinc-600 dark:bg-zinc-900"
      />
    </div>
  );

  if (wide) {
    const topics = [...new Set(questions.map((q) => q.topic))];
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void saveAll();
        }}
        noValidate
        data-testid="finish-form"
      >
        <ParticipantDataWarning />
        {topics.map((t) => (
          <fieldset key={t} className="mt-6">
            <legend className="text-xl font-semibold">{TOPIC_TITLES[t]}</legend>
            {questions.filter((q) => q.topic === t).map((q) => field(q))}
          </fieldset>
        ))}
        {message ? (
          <p role="alert" className="mt-4 text-sm leading-6">
            {message}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="btn-primary mt-6"
          data-testid="finish-next"
        >
          {busy ? "Filling in your documents…" : "Finish my pack"}
        </button>
      </form>
    );
  }

  const q = questions[index];
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void next(q);
      }}
      noValidate
      data-testid="finish-form"
    >
      <p
        className="mt-2 text-sm text-zinc-600 dark:text-zinc-400"
        data-testid="finish-progress"
      >
        Question {index + 1} of {questions.length}
      </p>
      {index === 0 ? <ParticipantDataWarning /> : null}
      {field(q, true)}
      {message ? (
        <p role="alert" className="mt-4 text-sm leading-6">
          {message}
        </p>
      ) : null}
      <div className="mt-6 flex items-center gap-4">
        {index > 0 ? (
          <button
            type="button"
            onClick={() => setIndex(index - 1)}
            disabled={busy}
            className="inline-flex min-h-11 items-center underline underline-offset-4"
          >
            Back
          </button>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="btn-primary"
          data-testid="finish-next"
        >
          {busy
            ? "Saving…"
            : index + 1 < questions.length
              ? "Next"
              : "Finish my pack"}
        </button>
      </div>
    </form>
  );
}
