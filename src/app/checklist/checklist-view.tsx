"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ParticipantDataWarning } from "@/app/start/_components/fields";
import {
  CHECKLIST_STATUSES,
  progressLine,
  type ChecklistStatus,
} from "@/lib/checklist/derive";
import {
  DRAFTED_LABEL,
  statusLabel,
  type ShownChecklist,
  type ShownItem,
} from "@/lib/checklist/state";
import { saveChecklistItemAction } from "@/server/checklist/actions";

/**
 * The interactive checklist (REQ-006 FR-3): groups as disclosure widgets,
 * the first incomplete one open; each item a radio group named by the item
 * title, a note with the no-participant-data warning stated once at the top,
 * and the why line with its source. Saves on change; notes save a moment
 * after typing stops.
 */
type Local = Record<string, { status: ShownItem["status"]; note: string }>;

const NOTE_MAX = 500;

export function ChecklistView({
  tradingName,
  pathway,
  shown,
}: {
  tradingName: string;
  pathway: "verification" | "certification";
  shown: ShownChecklist;
}) {
  const [local, setLocal] = useState<Local>(() =>
    Object.fromEntries(
      shown.items.map((i) => [i.id, { status: i.status, note: i.note }]),
    ),
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const ready = shown.items.filter(
    (i) => local[i.id]?.status === "have",
  ).length;

  const save = useCallback(
    async (itemId: string, status: ShownItem["status"], note: string) => {
      // A drafted document that gets a note is stored as in progress (FR-2).
      const stored: ChecklistStatus =
        status === "drafted" ? "in-progress" : status;
      setSaving(itemId);
      setMessage(null);
      const r = await saveChecklistItemAction({ itemId, status: stored, note });
      setSaving(null);
      setMessage(r.ok ? "Saved" : r.message);
    },
    [],
  );

  function onStatus(item: ShownItem, status: ChecklistStatus) {
    const next = { status, note: local[item.id]?.note ?? "" };
    setLocal((l) => ({ ...l, [item.id]: next }));
    void save(item.id, status, next.note);
  }

  function onNote(item: ShownItem, note: string) {
    const current = local[item.id] ?? { status: item.status, note: "" };
    setLocal((l) => ({ ...l, [item.id]: { ...current, note } }));
    clearTimeout(timers.current[item.id]);
    timers.current[item.id] = setTimeout(
      () => void save(item.id, current.status, note),
      800,
    );
  }

  useEffect(() => {
    const pending = timers.current;
    return () => Object.values(pending).forEach(clearTimeout);
  }, []);

  return (
    <div className="print:hidden">
      <h1 className="text-3xl font-semibold tracking-tight">
        Readiness checklist
      </h1>
      <p className="mt-3 leading-7 text-zinc-700 dark:text-zinc-300">
        For <strong>{tradingName}</strong>, a {pathway} audit. Tick things off
        as you get ready; your answers to the questionnaire pre-filled what you
        said you already have.
      </p>
      <p
        className="mt-4 text-lg font-medium"
        role="status"
        aria-live="polite"
        data-testid="checklist-progress"
      >
        {progressLine(ready, shown.total)}
      </p>
      <p
        className="mt-3 rounded-md border border-zinc-300 bg-zinc-50 p-3 text-sm leading-6 dark:border-zinc-700 dark:bg-zinc-900"
        data-testid="checklist-privacy"
        id="checklist-note-warning"
      >
        Notes are for your own reminders. <ParticipantDataWarning />
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-zinc-300 px-4 font-medium hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-zinc-700 dark:hover:bg-zinc-900"
          data-testid="checklist-print-button"
        >
          Print this checklist
        </button>
        <span
          role="status"
          aria-live="polite"
          className="text-zinc-600 dark:text-zinc-400"
          data-testid="checklist-save-status"
        >
          {saving ? "Saving…" : (message ?? "")}
        </span>
      </div>

      {shown.groups.map((g) => {
        const groupReady = g.items.filter(
          (i) => local[i.id]?.status === "have",
        ).length;
        return (
          <details
            key={g.id}
            open={g.open}
            className="mt-6 rounded-md border border-zinc-200 dark:border-zinc-800"
            data-testid={`checklist-group-${g.id}`}
          >
            <summary className="min-h-12 cursor-pointer px-4 py-3 text-lg font-semibold">
              {g.title}{" "}
              <span className="text-base font-normal text-zinc-600 dark:text-zinc-400">
                ({groupReady} of {g.items.length} ready)
              </span>
            </summary>
            <ul className="divide-y divide-zinc-200 px-4 dark:divide-zinc-800">
              {g.items.map((item) => (
                <ChecklistRow
                  key={item.id}
                  item={item}
                  status={local[item.id]?.status ?? item.status}
                  note={local[item.id]?.note ?? ""}
                  onStatus={(s) => onStatus(item, s)}
                  onNote={(n) => onNote(item, n)}
                />
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}

function ChecklistRow({
  item,
  status,
  note,
  onStatus,
  onNote,
}: {
  item: ShownItem;
  status: ShownItem["status"];
  note: string;
  onStatus: (s: ChecklistStatus) => void;
  onNote: (n: string) => void;
}) {
  const base = item.id.replace(/[^a-z0-9]+/g, "-");
  const whyId = `${base}-why`;
  const noteId = `${base}-note`;
  return (
    <li className="py-4" data-testid={`checklist-item-${base}`}>
      <fieldset aria-describedby={whyId}>
        <legend className="text-base font-medium">
          {item.title}
          {item.unverified ? (
            <span className="ml-2 rounded-full border border-amber-700 px-2 py-0.5 text-xs font-medium text-amber-800 dark:border-amber-400 dark:text-amber-300">
              Not confirmed by the Commission&apos;s text
            </span>
          ) : null}
        </legend>
        <p
          id={whyId}
          className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400"
        >
          {item.why}{" "}
          {item.sourceRef.kind === "content" ? (
            <span>Source: {item.sourceRef.title}.</span>
          ) : (
            <a
              href={item.sourceRef.url}
              className="underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              Source: {item.sourceRef.title}
              {item.sourceRef.kind === "standard" && item.sourceRef.indicator
                ? `, indicator ${item.sourceRef.indicator}`
                : ""}{" "}
              (opens in a new tab)
            </a>
          )}
        </p>
        {status === "drafted" ? (
          <p
            className="mt-2 text-sm font-medium"
            data-testid={`checklist-drafted-${base}`}
          >
            {DRAFTED_LABEL}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          {CHECKLIST_STATUSES.map((s) => {
            const id = `${base}-${s}`;
            return (
              <label
                key={s}
                htmlFor={id}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-zinc-200 px-3 has-[:checked]:border-zinc-900 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 dark:border-zinc-800 dark:has-[:checked]:border-zinc-100"
              >
                <input
                  type="radio"
                  id={id}
                  name={`${base}-status`}
                  value={s}
                  checked={status === s}
                  onChange={() => onStatus(s)}
                  className="h-4 w-4"
                />
                <span className="text-sm">{statusLabel(s, item.group)}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <label htmlFor={noteId} className="mt-3 block text-sm font-medium">
        Note (optional). Do not enter participant names or health details.
      </label>
      <textarea
        id={noteId}
        value={note}
        maxLength={NOTE_MAX}
        rows={2}
        onChange={(e) => onNote(e.target.value)}
        aria-describedby="checklist-note-warning"
        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-950"
      />
    </li>
  );
}
