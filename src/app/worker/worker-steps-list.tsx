"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OnboardingItemRow } from "@/lib/registers/audit-day-types";
import type { WorkerOnboardingItem } from "@/lib/registers/onboarding-items";
import type { WorkerClearanceRow } from "@/lib/registers/types";
import {
  ACKNOWLEDGEMENT_DOCUMENTS,
  acknowledgementsOutstanding,
  W1_ITEM_ID,
  workerStepState,
  STEP_WORDS,
  type AcknowledgementRow,
  type AdoptedDocument,
} from "@/lib/registers/worker-steps";
import { documentTitle } from "@/lib/questionnaire/content";
import {
  workerAcknowledgeAction,
  workerDateItemAction,
  workerSaveClearanceAction,
  type WorkerStepResult,
} from "@/server/registers/worker-steps-actions";

/**
 * REQ-024 Session B (FR-7, FR-8; D-2438, D-2444): the worker's own steps,
 * in the owner's order, each with its state in words and the control for
 * what is theirs: the three fields of their screening row (W-1), a date
 * (W-4, W-5 and any shared item), an acknowledge button per adopted
 * document (W-3, W-6). An owner's item says so. Every save refreshes the
 * server-rendered list; nothing is kept in the browser.
 */
const inputClass =
  "block w-full min-h-12 rounded-md border border-line bg-surface px-3 py-2 text-base text-ink shadow-sm";

type AckItemId = keyof typeof ACKNOWLEDGEMENT_DOCUMENTS;
const isAckItem = (id: string): id is AckItemId =>
  id in ACKNOWLEDGEMENT_DOCUMENTS;

export function WorkerStepsList({
  items,
  states,
  screening,
  acknowledgements,
  adopted,
  today,
}: {
  items: WorkerOnboardingItem[];
  states: OnboardingItemRow[];
  screening: Omit<WorkerClearanceRow, "note"> | null;
  acknowledgements: AcknowledgementRow[];
  adopted: [string, AdoptedDocument][];
  today: string;
}) {
  const router = useRouter();
  const byId = new Map(states.map((s) => [s.item_id, s]));
  const adoptedMap = new Map(adopted);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [application, setApplication] = useState(
    screening?.application_number ?? "",
  );
  const [number, setNumber] = useState(screening?.clearance_number ?? "");
  const [expiry, setExpiry] = useState(screening?.expires_on ?? "");
  const [dates, setDates] = useState<Record<string, string>>({});

  async function run(key: string, call: () => Promise<WorkerStepResult>) {
    setPending(key);
    setMessage(null);
    setFieldErrors({});
    try {
      const r = await call();
      if (!r.ok) {
        setMessage(r.message);
        setFieldErrors(r.fieldErrors ?? {});
        return;
      }
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  const done = items.filter(
    (i) => workerStepState(i, byId.get(i.id), screening) === "confirmed",
  ).length;

  return (
    <section
      aria-labelledby="worker-steps-heading"
      className="mt-8"
      data-testid="worker-steps"
    >
      <h2 id="worker-steps-heading" className="">
        Your steps{" "}
        <span className="text-slate" data-testid="worker-steps-count">
          ({done} of {items.length} confirmed)
        </span>
      </h2>
      <p className="text-slate mt-1 text-sm leading-7">
        What you do here waits for your manager to confirm it; the date they
        confirm is the one an auditor reads. Your manager records the rest.
      </p>
      {message ? (
        <p role="alert" className="text-ink mt-3 text-sm leading-6">
          {message}
        </p>
      ) : null}
      <ol className="divide-rule mt-3 divide-y">
        {items.map((item) => {
          const s = byId.get(item.id);
          // D-2834: W-1 is the worker's step whatever the owner's list says about who confirms it.
          const state = workerStepState(item, s, screening);
          const theirs = item.who !== "owner" || item.id === W1_ITEM_ID;
          return (
            <li
              key={item.id}
              className="py-3 leading-7"
              data-testid={`worker-step-${item.id}`}
              data-state={state}
            >
              <div className="flex items-start gap-3">
                <span aria-hidden="true" className="w-5 shrink-0">
                  {state === "confirmed" || state === "recorded-by-manager"
                    ? "✓"
                    : "○"}
                </span>
                <div className="min-w-0 flex-1">
                  <p>{item.text}</p>
                  <p
                    className="text-ink mt-1 text-sm"
                    data-testid={`worker-step-state-${item.id}`}
                  >
                    {STEP_WORDS[state]}
                    {s?.done_on && state !== "manager-records"
                      ? ` (you recorded ${s.done_on}`
                      : ""}
                    {s?.confirmed_on
                      ? `${s?.done_on ? "; " : " ("}confirmed ${s.confirmed_on})`
                      : s?.done_on
                        ? ")"
                        : ""}
                    .
                  </p>
                  {theirs &&
                  state !== "confirmed" &&
                  state !== "recorded-by-manager" ? (
                    item.id === W1_ITEM_ID ? (
                      <div
                        className="border-rule mt-2 rounded-md border p-3"
                        data-testid="worker-clearance-form"
                      >
                        <p className="text-slate text-sm">
                          Your NDIS Worker Screening Check: the numbers from the
                          unit&apos;s notice and the expiry on the clearance. No
                          names here; your manager checks the database and
                          confirms.
                          {screening
                            ? ""
                            : " Your manager has not recorded the application yet: type its number from the unit's notice and they confirm it."}
                        </p>
                        <label
                          className="mt-2 block text-sm"
                          htmlFor="ws-application"
                        >
                          {screening
                            ? "Application number (optional)"
                            : "Application number"}
                        </label>
                        <input
                          id="ws-application"
                          className={inputClass}
                          value={application}
                          onChange={(e) => setApplication(e.target.value)}
                          autoComplete="off"
                        />
                        {fieldErrors.application_number?.map((m) => (
                          <p key={m} className="mt-1 text-sm text-red-700">
                            {m}
                          </p>
                        ))}
                        <label
                          className="mt-2 block text-sm"
                          htmlFor="ws-number"
                        >
                          Check number (optional)
                        </label>
                        <input
                          id="ws-number"
                          className={inputClass}
                          value={number}
                          onChange={(e) => setNumber(e.target.value)}
                          autoComplete="off"
                        />
                        {fieldErrors.clearance_number?.map((m) => (
                          <p key={m} className="mt-1 text-sm text-red-700">
                            {m}
                          </p>
                        ))}
                        <label
                          className="mt-2 block text-sm"
                          htmlFor="ws-expiry"
                        >
                          Expiry (optional)
                        </label>
                        <input
                          id="ws-expiry"
                          type="date"
                          className={`${inputClass} max-w-60`}
                          value={expiry}
                          onChange={(e) => setExpiry(e.target.value)}
                        />
                        {fieldErrors.expires_on?.map((m) => (
                          <p key={m} className="mt-1 text-sm text-red-700">
                            {m}
                          </p>
                        ))}
                        <button
                          type="button"
                          className="btn-secondary mt-3 text-sm"
                          disabled={pending !== null}
                          aria-busy={pending === "clearance" || undefined}
                          data-testid="worker-clearance-save"
                          onClick={() =>
                            run("clearance", () =>
                              workerSaveClearanceAction({
                                clearance_id: screening?.id ?? "",
                                application_number: application,
                                clearance_number: number,
                                expires_on: expiry,
                              }),
                            )
                          }
                        >
                          {pending === "clearance"
                            ? "Saving…"
                            : "Save my check details"}
                        </button>
                      </div>
                    ) : isAckItem(item.id) ? (
                      (() => {
                        const out = acknowledgementsOutstanding(
                          item.id,
                          adoptedMap,
                          acknowledgements,
                        );
                        const required = ACKNOWLEDGEMENT_DOCUMENTS[item.id];
                        return (
                          <ul
                            className="mt-2 space-y-2 text-sm"
                            data-testid={`worker-ack-${item.id}`}
                          >
                            {required.map((typeId) => {
                              const doc = adoptedMap.get(typeId);
                              const ack = doc
                                ? acknowledgements.find(
                                    (a) =>
                                      a.document_type_id === typeId &&
                                      a.version === doc.version,
                                  )
                                : undefined;
                              return (
                                <li
                                  key={typeId}
                                  className="flex flex-wrap items-center gap-2"
                                >
                                  <span>
                                    {documentTitle(typeId)}
                                    {doc ? ` (version ${doc.version})` : ""}
                                  </span>
                                  {!doc ? (
                                    <span className="text-slate">
                                      not adopted by your manager yet
                                    </span>
                                  ) : ack ? (
                                    <span
                                      className="text-slate"
                                      data-testid={`worker-ack-done-${typeId}`}
                                    >
                                      acknowledged {ack.acknowledged_on}
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn-secondary text-sm"
                                      disabled={pending !== null}
                                      aria-busy={
                                        pending === `ack-${typeId}` || undefined
                                      }
                                      data-testid={`worker-ack-${typeId}`}
                                      onClick={() =>
                                        run(`ack-${typeId}`, () =>
                                          workerAcknowledgeAction({
                                            document_type_id: typeId,
                                            version: doc.version,
                                          }),
                                        )
                                      }
                                    >
                                      {pending === `ack-${typeId}`
                                        ? "Saving…"
                                        : "I have read this"}
                                    </button>
                                  )}
                                </li>
                              );
                            })}
                            {out.notAdopted.length === required.length ? (
                              <li className="text-slate">
                                Nothing to acknowledge until your manager adopts
                                the documents.
                              </li>
                            ) : null}
                          </ul>
                        );
                      })()
                    ) : s ? (
                      <div
                        className="mt-2 flex flex-wrap items-end gap-3"
                        data-testid={`worker-date-${item.id}`}
                      >
                        <div>
                          <label
                            className="block text-sm"
                            htmlFor={`date-${item.id}`}
                          >
                            {item.counts === "date"
                              ? "Date"
                              : "Date you did it"}
                          </label>
                          <input
                            id={`date-${item.id}`}
                            type="date"
                            className={`${inputClass} max-w-60`}
                            value={dates[item.id] ?? today}
                            max={today}
                            onChange={(e) =>
                              setDates((d) => ({
                                ...d,
                                [item.id]: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <button
                          type="button"
                          className="btn-secondary text-sm"
                          disabled={pending !== null}
                          aria-busy={pending === item.id || undefined}
                          data-testid={`worker-done-${item.id}`}
                          onClick={() =>
                            run(item.id, () =>
                              workerDateItemAction({
                                item_id: s.id,
                                done_on: dates[item.id] ?? today,
                              }),
                            )
                          }
                        >
                          {pending === item.id ? "Saving…" : "I did this"}
                        </button>
                      </div>
                    ) : null
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
