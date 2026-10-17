"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  OnboardingItemRow,
  OnboardingTickRow,
} from "@/lib/registers/audit-day-types";
import {
  sourceLine,
  type WorkerOnboardingItem,
} from "@/lib/registers/onboarding-items";
import type { WorkerState } from "@/lib/registers/worker-state";
import { FROM_THE_DATES_LINE } from "@/lib/registers/worker-state";
import { tickOnboardingItemAction } from "@/server/registers/audit-day-actions";
import { DateField, RefField } from "./inputs";

/**
 * A worker's derived onboarding list (REQ-024 A1, FR-2, FR-3; D-2411): each
 * item with who does it, what counts as done, its dates, the auditor's ask
 * and the source line; the state at the top in the words the REQ allows
 * (never "ready"); one "who" code and date serve every tick on the page.
 * The owner's tick confirms an item and, for an item the worker shares,
 * records the worker's date too ("recorded by your manager", D-2438).
 */
const WHO: Record<WorkerOnboardingItem["who"], string> = {
  owner: "You record it",
  worker: "The worker does it; you confirm it",
  both: "Both of you: the worker does it, you confirm it",
};

const COUNTS: Record<WorkerOnboardingItem["counts"], string> = {
  date: "a date",
  number: "a number on the worker checks row",
  expiry: "an expiry on the worker checks row",
  tick: "a tick with a date",
};

export function WorkerItems({
  checklistId,
  items,
  states,
  ticks,
  derived,
  canWrite,
  today,
}: {
  checklistId: string | null;
  items: WorkerOnboardingItem[];
  states: OnboardingItemRow[];
  ticks: OnboardingTickRow[];
  derived: WorkerState;
  canWrite: boolean;
  today: string;
}) {
  const router = useRouter();
  const byId = new Map(states.map((s) => [s.item_id, s]));
  const lastTick = new Map<string, OnboardingTickRow>();
  for (const t of ticks) lastTick.set(t.item_id, t);
  const [who, setWho] = useState("");
  const [on, setOn] = useState(today);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const outstanding = new Set(derived.outstanding);

  async function tick(itemId: string) {
    if (!checklistId) return;
    setPending(itemId);
    setErrors([]);
    try {
      const r = await tickOnboardingItemAction({
        checklist_id: checklistId,
        item_id: itemId,
        ticked_on: on,
        ticked_by_ref: who,
      });
      if (!r.ok) {
        setErrors([
          ...(r.fieldErrors?.ticked_by_ref ?? []),
          ...(r.fieldErrors?.ticked_on ?? []),
          r.message,
        ]);
        return;
      }
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <section
      aria-labelledby="worker-items-heading"
      className="mt-6"
      data-testid="worker-items"
    >
      <h2 id="worker-items-heading" className="text-lg font-semibold">
        <span data-testid="worker-state">{derived.label}</span>
        {derived.outstanding.length > 0 ? (
          <span className="text-zinc-600 dark:text-zinc-400">
            {" "}
            ({derived.outstanding.length} before the first shift)
          </span>
        ) : null}
      </h2>
      <p
        className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400"
        data-testid="from-the-dates-line"
      >
        {FROM_THE_DATES_LINE}
      </p>
      {derived.next ? (
        <p className="mt-2 text-sm leading-6" data-testid="worker-next">
          <span className="font-medium">Next:</span> {derived.next}
        </p>
      ) : null}
      {derived.roleAssessmentToRecord ? (
        <p
          className="border-ochre mt-2 rounded-md border p-3 text-sm leading-6"
          data-testid="role-assessment-line"
        >
          Role assessment to record: this is a risk assessed role and the roles
          list has no assessed date for it yet (Worker Screening Rules s 17).
        </p>
      ) : null}
      {canWrite && checklistId && derived.key !== "ended" ? (
        <div className="mt-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
          <RefField
            id="ticked-by"
            label="Who is recording this"
            hint="KP-1 or your own worker code"
            errors={errors}
            value={who}
            onChange={setWho}
            optional={false}
          />
          <DateField
            id="ticked-on"
            label="Date"
            errors={[]}
            value={on}
            onChange={setOn}
          />
        </div>
      ) : null}
      <ol className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
        {items.map((item) => {
          const s = byId.get(item.id);
          const t = lastTick.get(item.id);
          const open = item.beforeFirstShift
            ? outstanding.has(item.id)
            : !s?.confirmed_on;
          return (
            <li
              key={item.id}
              className="py-3 leading-7"
              data-testid={`worker-item-${item.id}`}
              data-state={open ? "open" : "recorded"}
            >
              <div className="flex items-start gap-3">
                <span aria-hidden="true" className="w-5 shrink-0">
                  {open ? "○" : "✓"}
                </span>
                <div className="min-w-0 flex-1">
                  <p>
                    {item.text}
                    {item.beforeFirstShift ? (
                      <span className="ml-2 rounded-full border border-zinc-300 px-2 py-0.5 text-xs whitespace-nowrap text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                        before the first shift
                      </span>
                    ) : null}
                    {item.yourCall ? (
                      <span className="ml-2 rounded-full border border-zinc-300 px-2 py-0.5 text-xs whitespace-nowrap text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                        your call
                      </span>
                    ) : null}
                  </p>
                  {item.stateLines?.length ? (
                    <ul className="mt-1 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                      {item.stateLines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {WHO[item.who]}; what counts: {COUNTS[item.counts]}.
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    The auditor asks: {item.ask}
                  </p>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    Source: {sourceLine(item.source)}
                  </p>
                  {s?.done_on || s?.confirmed_on ? (
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {s.done_on ? `Done ${s.done_on}` : "Not yet done"}
                      {s.recorded_by_owner ? " (recorded by your manager)" : ""}
                      {s.confirmed_on
                        ? `; confirmed ${s.confirmed_on}${t ? ` by ${t.ticked_by_ref}` : ""}.`
                        : "; waiting for your confirmation."}
                    </p>
                  ) : null}
                  {canWrite && checklistId && !s?.confirmed_on ? (
                    <button
                      type="button"
                      className="btn-secondary mt-2 text-sm"
                      disabled={pending !== null}
                      aria-busy={pending === item.id || undefined}
                      onClick={() => tick(item.id)}
                      data-testid={`record-${item.id}`}
                    >
                      {pending === item.id ? "Saving…" : "Record: done"}
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
