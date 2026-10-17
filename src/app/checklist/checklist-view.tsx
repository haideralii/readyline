"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ParticipantDataWarning } from "@/app/start/_components/fields";
import {
  CHECKLIST_STATUSES,
  progressLine,
  type ChecklistStatus,
} from "@/lib/checklist/derive";
import {
  DRAFTED_LABEL,
  type ShownChecklist,
  type ShownItem,
  type ShownStatus,
} from "@/lib/checklist/state";
import { saveChecklistItemAction } from "@/server/checklist/actions";
import { GlossaryTerms } from "@/components/glossary-terms";
import { findGlossaryTerms } from "@/lib/copy-lint/glossary";

/**
 * The checklist as a task list (REQ-015 Section C): the counts line and the
 * next three things to do at the top; each item one row with a status tag
 * that opens to its controls; a segmented status control that shows the
 * choice at once, "Saved" within a moment, an undo for five seconds, and a
 * retry when the save fails (FR-8 to FR-12, FR-15). The stored values stay
 * `need`, `in-progress` and `have`; only the labels changed.
 */
type Local = Record<
  string,
  { status: ShownStatus; note: string; doneOn: string | null }
>;

type Feedback =
  | { kind: "saving"; itemId: string }
  | { kind: "saved"; itemId: string; undo: Local[string] | null }
  | { kind: "failed"; itemId: string; message: string; retry: () => void };

const NOTE_MAX = 500;
const SHORT_LABEL: Record<ChecklistStatus, string> = {
  need: "Need",
  "in-progress": "Doing",
  have: "Done",
};
const TAG: Record<ShownStatus, { icon: string; tone: string }> = {
  need: { icon: "○", tone: "border-ochre text-ochre" },
  "in-progress": { icon: "◐", tone: "border-slate text-slate" },
  have: { icon: "✓", tone: "border-moss text-moss" },
  drafted: { icon: "◐", tone: "border-slate text-slate" },
};

function tagLabel(status: ShownStatus): string {
  return status === "drafted" ? "Drafted" : SHORT_LABEL[status];
}

function StatusTag({ status }: { status: ShownStatus }) {
  const t = TAG[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm font-medium ${t.tone}`}
      data-testid="status-tag"
    >
      <span aria-hidden="true">{t.icon}</span>
      {tagLabel(status)}
    </span>
  );
}

export function ChecklistView({
  tradingName,
  pathway,
  shown,
  setId,
}: {
  tradingName: string;
  pathway: "verification" | "certification";
  shown: ShownChecklist;
  /** The newest ready set, so a document item opens its document in one tap (REQ-017 step 6). */
  setId: string | null;
}) {
  const [local, setLocal] = useState<Local>(() =>
    Object.fromEntries(
      shown.items.map((i) => [
        i.id,
        { status: i.status, note: i.note, doneOn: i.doneOn },
      ]),
    ),
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [openItems, setOpenItems] = useState<Set<string>>(() => new Set());
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ready = shown.items.filter(
    (i) => local[i.id]?.status === "have",
  ).length;

  const stored = (status: ShownStatus): ChecklistStatus =>
    status === "drafted" ? "in-progress" : status;

  async function save(
    itemId: string,
    next: Local[string],
    previous: Local[string] | null,
  ) {
    setFeedback({ kind: "saving", itemId });
    // REQ-023 FR-4: a dated item sends its date; the server sets the status from it (finding 80).
    const dated = shown.items.find((i) => i.id === itemId)?.dated;
    const r = await saveChecklistItemAction({
      itemId,
      status: stored(next.status),
      note: next.note,
      ...(dated ? { doneOn: next.doneOn ?? "" } : {}),
    });
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    if (r.ok) {
      setFeedback({ kind: "saved", itemId, undo: previous });
      // "Saved" stays for a moment; the undo stays five seconds (FR-15).
      feedbackTimer.current = setTimeout(
        () => setFeedback((f) => (f?.kind === "saved" ? null : f)),
        previous ? 5000 : 2000,
      );
    } else {
      // Revert to what the server has (FR-10).
      if (previous) setLocal((l) => ({ ...l, [itemId]: previous }));
      setFeedback({
        kind: "failed",
        itemId,
        message: r.message,
        retry: () => {
          setLocal((l) => ({ ...l, [itemId]: next }));
          void save(itemId, next, previous);
        },
      });
    }
  }

  function onStatus(item: ShownItem, status: ChecklistStatus) {
    const previous = local[item.id] ?? {
      status: item.status,
      note: "",
      doneOn: item.doneOn,
    };
    if (previous.status === status) return;
    const next = { ...previous, status };
    setLocal((l) => ({ ...l, [item.id]: next }));
    void save(item.id, next, previous);
  }

  // REQ-023 FR-4: a date sets Done, a cleared date sets Need (finding 80).
  function onDate(item: ShownItem, doneOn: string) {
    const previous = local[item.id] ?? {
      status: item.status,
      note: "",
      doneOn: item.doneOn,
    };
    const next = {
      status: (doneOn ? "have" : "need") as ShownStatus,
      note: previous.note,
      doneOn: doneOn || null,
    };
    setLocal((l) => ({ ...l, [item.id]: next }));
    void save(item.id, next, previous);
  }

  function onNote(item: ShownItem, note: string) {
    const current = local[item.id] ?? {
      status: item.status,
      note: "",
      doneOn: item.doneOn,
    };
    const next = { ...current, note };
    setLocal((l) => ({ ...l, [item.id]: next }));
    clearTimeout(timers.current[item.id]);
    timers.current[item.id] = setTimeout(
      () => void save(item.id, next, null),
      800,
    );
  }

  function undo(itemId: string, previous: Local[string]) {
    setLocal((l) => ({ ...l, [itemId]: previous }));
    void save(itemId, previous, null);
  }

  useEffect(() => {
    const pending = timers.current;
    return () => {
      Object.values(pending).forEach(clearTimeout);
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    };
  }, []);

  const toggleItem = (id: string, open?: boolean) =>
    setOpenItems((s) => {
      const next = new Set(s);
      const willOpen = open ?? !next.has(id);
      if (willOpen) next.add(id);
      else next.delete(id);
      return next;
    });

  // FR-8: the first three items still to do, in audit order.
  const nextThree = shown.items
    .filter((i) => (local[i.id]?.status ?? i.status) === "need")
    .slice(0, 3);

  function goTo(item: ShownItem) {
    setOpenGroups((g) => ({ ...g, [item.group]: true }));
    toggleItem(item.id, true);
    requestAnimationFrame(() => {
      const el = document.getElementById(rowId(item.id));
      el?.scrollIntoView({ block: "start" });
      el?.focus();
    });
  }

  const status = (() => {
    if (!feedback) return "";
    if (feedback.kind === "saving") return "Saving…";
    if (feedback.kind === "saved") return "Saved";
    return feedback.message;
  })();

  // REQ-027 FR-3, D-2711: the glossary terms this checklist is about to show,
  // from the page's own words and every item's title and detail, in the
  // order they first appear.
  const present = findGlossaryTerms(
    [
      `For ${tradingName}, a ${pathway} audit. Tap an item to set its status. Done means reviewed and adopted.`,
      ...shown.groups.map((g) => g.title),
      ...shown.items.flatMap((i) => [i.title, i.ask, i.why, i.haveNote ?? ""]),
    ].join("\n"),
  );

  return (
    <div className="print:hidden">
      <h1 className="">Readiness checklist</h1>
      <p className="text-ink mt-3 leading-7">
        For <strong>{tradingName}</strong>, a {pathway} audit. Tap an item to
        set its status. <strong>Done</strong> means reviewed and adopted.
      </p>
      {/* REQ-027 FR-3, D-2701, D-2711: the words on this page, counted at render from the items it shows, above the first body section. */}
      <GlossaryTerms ids={present} where="page" className="mt-3" />
      <p
        className="mt-4 text-lg font-medium"
        role="status"
        aria-live="polite"
        data-testid="checklist-progress"
      >
        {progressLine(ready, shown.total)}
      </p>
      {/* FR-11: the participant-data warning once, at the top. */}
      <p
        className="border-rule bg-mist mt-3 rounded-md border p-4 text-sm leading-6"
        data-testid="checklist-privacy"
        id="checklist-note-warning"
      >
        Notes are for your own reminders. <ParticipantDataWarning />
      </p>

      {nextThree.length > 0 ? (
        <section
          aria-labelledby="next-three-heading"
          className="border-ochre mt-5 rounded-md border p-4"
          data-testid="checklist-next"
        >
          <h2 id="next-three-heading" className="">
            Next three things to do
          </h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            {nextThree.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  className="inline-flex min-h-11 items-center text-left underline underline-offset-4"
                  data-testid={`next-${base(i.id)}`}
                >
                  {i.title}
                </button>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => window.print()}
          className="btn-secondary text-sm"
          data-testid="checklist-print-button"
        >
          Print this checklist
        </button>
        <span
          role="status"
          aria-live="polite"
          className="text-slate inline-flex min-h-11 items-center gap-2"
          data-testid="checklist-save-status"
        >
          {feedback?.kind === "saved" ? (
            <span aria-hidden="true" className="text-moss">
              ✓
            </span>
          ) : null}
          {status}
          {feedback?.kind === "saved" && feedback.undo ? (
            <button
              type="button"
              className="min-h-11 underline underline-offset-4"
              onClick={() => undo(feedback.itemId, feedback.undo!)}
              data-testid="checklist-undo"
            >
              Undo
            </button>
          ) : null}
          {feedback?.kind === "failed" ? (
            <button
              type="button"
              className="min-h-11 underline underline-offset-4"
              onClick={feedback.retry}
              data-testid="checklist-retry"
            >
              Try again
            </button>
          ) : null}
        </span>
      </div>

      {shown.groups.map((g) => {
        const groupReady = g.items.filter(
          (i) => local[i.id]?.status === "have",
        ).length;
        return (
          <details
            key={g.id}
            open={openGroups[g.id] ?? g.open}
            onToggle={(e) => {
              const isOpen = e.currentTarget.open;
              setOpenGroups((s) =>
                s[g.id] === isOpen ? s : { ...s, [g.id]: isOpen },
              );
            }}
            className="border-rule mt-6 rounded-md border"
            data-testid={`checklist-group-${g.id}`}
          >
            <summary className="min-h-12 cursor-pointer px-4 py-3 text-lg font-semibold">
              {g.title}{" "}
              <span className="text-slate text-base font-normal">
                ({groupReady} of {g.items.length} ready)
              </span>
            </summary>
            <ul className="divide-rule divide-y px-4">
              {g.items.map((item) => (
                <ChecklistRow
                  key={item.id}
                  item={item}
                  setId={setId}
                  status={local[item.id]?.status ?? item.status}
                  note={local[item.id]?.note ?? ""}
                  doneOn={local[item.id]?.doneOn ?? item.doneOn}
                  open={openItems.has(item.id)}
                  onToggle={() => toggleItem(item.id)}
                  onStatus={(s) => onStatus(item, s)}
                  onDate={(d) => onDate(item, d)}
                  onNote={(n) => onNote(item, n)}
                  feedback={feedback?.itemId === item.id ? feedback : null}
                />
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}

function base(id: string) {
  return id.replace(/[^a-z0-9]+/g, "-");
}
function rowId(id: string) {
  return `${base(id)}-row`;
}

function ChecklistRow({
  item,
  setId,
  status,
  note,
  doneOn,
  open,
  onToggle,
  onStatus,
  onDate,
  onNote,
  feedback,
}: {
  item: ShownItem;
  setId: string | null;
  status: ShownStatus;
  note: string;
  doneOn: string | null;
  open: boolean;
  onToggle: () => void;
  onStatus: (s: ChecklistStatus) => void;
  onDate: (d: string) => void;
  onNote: (n: string) => void;
  feedback: Feedback | null;
}) {
  const b = base(item.id);
  const whyId = `${b}-why`;
  const noteId = `${b}-note`;
  const panelId = `${b}-panel`;
  const [noteOpen, setNoteOpen] = useState(note.length > 0);
  // REQ-017 step 6: one tap to do it where the app can; a document item opens its document.
  const action =
    item.action ??
    (item.documentTypeId && setId
      ? {
          label: "Open this document",
          href: `/documents/${setId}/${item.documentTypeId}`,
        }
      : null);
  return (
    <li className="py-2" data-testid={`checklist-item-${b}`}>
      {/* FR-9: one row; the controls open under it. */}
      <button
        type="button"
        id={rowId(item.id)}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-md py-2 text-left"
        data-testid={`checklist-row-${b}`}
      >
        {/* REQ-013 batch 36 item 2: the evidence-confidence flag is for the admin view, never the customer. */}
        <span className="min-w-0 text-base font-medium">{item.title}</span>
        <span className="flex shrink-0 items-center gap-2">
          <StatusTag status={status} />
          <span aria-hidden="true" className="text-slate">
            {open ? "▴" : "▾"}
          </span>
        </span>
      </button>
      <div id={panelId} hidden={!open} className="pb-3">
        <p id={whyId} className="text-slate mt-1 text-sm leading-6">
          {item.why}{" "}
          {item.sourceRef.kind === "content" ? (
            <span>{item.sourceRef.title}.</span>
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
        {item.haveNote ? (
          // REQ-025 FR-4, D-2216: "already have" means review, not skip.
          <p
            className="text-ink mt-1 text-sm leading-6"
            data-testid={`checklist-have-note-${b}`}
          >
            {item.haveNote}
          </p>
        ) : null}
        {item.unverified ? (
          <p
            className="text-slate mt-1 text-sm leading-6"
            data-testid={`checklist-check-${b}`}
          >
            Check this against the Commission&apos;s page before you rely on it;
            the link above is the place to look.
          </p>
        ) : null}
        {action ? (
          <p className="mt-2">
            <Link
              href={action.href}
              className="btn-secondary text-sm"
              data-testid={`checklist-action-${b}`}
            >
              {action.label}
            </Link>
          </p>
        ) : null}
        {status === "drafted" ? (
          <p
            className="mt-2 text-sm font-medium"
            data-testid={`checklist-drafted-${b}`}
          >
            {DRAFTED_LABEL}{" "}
            <Link href="/documents" className="underline underline-offset-2">
              Open your documents
            </Link>
          </p>
        ) : null}
        {item.dated ? (
          // REQ-023 FR-4: a dated item is done by its date, not by a tap; the date is what the auditor reads.
          <div className="mt-3" data-testid={`checklist-date-${b}`}>
            <label htmlFor={`${b}-date`} className="block text-sm font-medium">
              Date it happened
            </label>
            {item.dueDate ? (
              <p className="text-slate mt-1 text-sm">
                Measured against {item.dueDate}.
              </p>
            ) : null}
            <input
              id={`${b}-date`}
              type="date"
              value={doneOn ?? ""}
              onChange={(e) => onDate(e.target.value)}
              aria-describedby={whyId}
              className="border-rule mt-1 rounded-md border px-3 py-2 text-base"
            />
            <span
              className="text-slate ml-3 inline-flex min-h-11 items-center text-sm"
              aria-live="polite"
              data-testid={`item-feedback-${b}`}
            >
              {feedback?.kind === "saving"
                ? "Saving…"
                : feedback?.kind === "saved"
                  ? "✓ Saved"
                  : feedback?.kind === "failed"
                    ? "Not saved, try again"
                    : ""}
            </span>
          </div>
        ) : null}
        {/* FR-10: a segmented control that never wraps at 375 px. */}
        <fieldset className="mt-3" aria-describedby={whyId} hidden={item.dated}>
          <legend className="text-sm font-medium">Status</legend>
          <div
            className="border-line mt-1 inline-flex max-w-full overflow-hidden rounded-md border"
            role="radiogroup"
            aria-label={`Status for ${item.title}`}
          >
            {CHECKLIST_STATUSES.map((s, i) => {
              const id = `${b}-${s}`;
              const checked = status === s;
              return (
                <label
                  key={s}
                  htmlFor={id}
                  className={`relative inline-flex min-h-11 min-w-16 cursor-pointer items-center justify-center px-3 text-sm ${
                    i > 0 ? "border-line border-l" : ""
                  } ${checked ? "bg-ink text-paper" : "hover:bg-mist"} has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2`}
                >
                  <input
                    type="radio"
                    id={id}
                    name={`${b}-status`}
                    value={s}
                    checked={checked}
                    onChange={() => onStatus(s)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                  {checked ? (
                    <span aria-hidden="true" className="mr-1">
                      ✓
                    </span>
                  ) : null}
                  {SHORT_LABEL[s]}
                </label>
              );
            })}
          </div>
          {item.dated ? null : (
            <span
              className="text-slate ml-3 inline-flex min-h-11 items-center text-sm"
              aria-live="polite"
              data-testid={`item-feedback-${b}`}
            >
              {feedback?.kind === "saving"
                ? "Saving…"
                : feedback?.kind === "saved"
                  ? "✓ Saved"
                  : feedback?.kind === "failed"
                    ? "Not saved, try again"
                    : ""}
            </span>
          )}
        </fieldset>
        {noteOpen ? (
          <>
            <label htmlFor={noteId} className="mt-3 block text-sm font-medium">
              Note
            </label>
            <textarea
              id={noteId}
              value={note}
              maxLength={NOTE_MAX}
              rows={2}
              onChange={(e) => onNote(e.target.value)}
              aria-describedby="checklist-note-warning"
              placeholder="Your reminder. No participant names or health details."
              className="border-line mt-1 w-full rounded-md border px-3 py-2 text-base"
            />
          </>
        ) : (
          <button
            type="button"
            className="mt-2 inline-flex min-h-11 items-center text-sm underline underline-offset-4"
            onClick={() => setNoteOpen(true)}
            data-testid={`add-note-${b}`}
          >
            Add a note
          </button>
        )}
      </div>
    </li>
  );
}
