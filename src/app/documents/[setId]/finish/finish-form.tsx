"use client";
import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";
import { ErrorSummary, type FieldErrors } from "@/app/start/_components/fields";
import { ConfirmButton } from "@/components/confirm-button";
import {
  FREE_TEXT_FACT_KEYS,
  NO_TOOL_FACTS,
  type FactQuestion,
} from "@/lib/generator/facts-fill";
import {
  DETAILS_ABN,
  DETAILS_BUSINESS_NAME,
  DETAILS_CLEARED,
  DETAILS_DONE_BUSY,
  DETAILS_DONE_BUTTON,
  DETAILS_DONE_LINE,
  DETAILS_FIELDS,
  DETAILS_NO_ABN,
  DETAILS_NO_TOOL_LABEL,
  DETAILS_READ_ONLY_HEADING,
  DETAILS_READ_ONLY_HELP,
  DETAILS_REAPPROVAL_LINE,
  DETAILS_REAPPROVED_LINE,
  DETAILS_REAPPROVE_BUTTON,
  DETAILS_REAPPROVE_CONFIRM,
  DETAILS_REAPPROVE_HEADING,
  DETAILS_REAPPROVE_LINE,
  DETAILS_REAPPROVE_QUESTION,
  DETAILS_SAVED,
  DETAILS_SAVING,
  DETAILS_UNREACHABLE,
  DETAILS_WARNING,
} from "@/lib/path/details-copy";
import { detectParticipantData } from "@/lib/privacy/participant-data";
import {
  clearFactAction,
  finishPackAction,
  reapproveAction,
  saveFactAction,
} from "@/server/path/actions";

/**
 * The "Your details" form (REQ-029 FR-1, FR-2, FR-12, SR-1, SR-6; D-2854,
 * D-2855, D-2860, D-2879): one page, every field saved as it loses focus
 * with "Saved" in words, a cleared field deleting its row (an empty value is
 * a visible blank, FR-4), the detector warning on each field (its name part
 * on the four free-text fields alone), "None" for the other tool filling
 * the three appendix keys, and one button that rebuilds the pack's files.
 * The component keeps its name so the path-screen lint reads it as the one
 * control of the page (REQ-017 FR-5).
 */
const INPUT =
  "border-line bg-surface text-ink block min-h-12 w-full rounded-md border px-3 py-2 text-base shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2";
const NO_TOOL_KEYS = Object.keys(NO_TOOL_FACTS);
// D-1012, D-2270 (9): a client form in the first HTML of a signed-in page is
// inert until React is live, so a value typed before hydration is never lost.
const noop = () => () => {};
const useLive = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
const FINISH_REPLY_MS = 60_000;

type Status = "idle" | "saving" | "saved" | "cleared";

export function FinishForm({
  setId,
  questions,
  initial,
  documentCount,
  prefill,
  business,
  reapprovals,
}: {
  setId: string;
  questions: FactQuestion[];
  initial: Record<string, string>;
  documentCount: number;
  /** FR-1: the state from the account when it has one; saved on the first render when the fact is empty. */
  prefill: Record<string, string>;
  business: { name: string; abn: string | null };
  /** FR-6: adopted documents whose snapshot differs from the name and role on the account. */
  reapprovals: number;
}) {
  const router = useRouter();
  const live = useLive();
  const [values, setValues] = useState<Record<string, string>>(() => ({
    ...initial,
    ...Object.fromEntries(
      Object.entries(prefill).filter(([k]) => !(initial[k] ?? "").trim()),
    ),
  }));
  const saved = useRef<Record<string, string>>({ ...initial });
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [errors, setErrors] = useState<FieldErrors>({});
  const [warnings, setWarnings] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [reapproved, setReapproved] = useState<number | null>(null);
  const inFlight = useRef(false);

  async function reapprove() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      for (const key of ["name", "role"]) if (!(await saveKey(key))) return;
      const r = await reapproveAction({ setId });
      if (!r.ok) {
        setMessage(r.message);
        return;
      }
      setReapproved(r.reapproved ?? 0);
      router.refresh();
    } catch {
      setMessage(DETAILS_UNREACHABLE);
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  const keys = questions.map((q) => q.key);
  const hasNoTool =
    keys.includes("other-tool") && NO_TOOL_KEYS.every((k) => keys.includes(k));
  const noTool = NO_TOOL_KEYS.every((k) => values[k] === NO_TOOL_FACTS[k]);

  async function saveKey(key: string): Promise<boolean> {
    const value = (values[key] ?? "").trim();
    if (value === (saved.current[key] ?? "").trim()) return true;
    setStatus((s) => ({ ...s, [key]: "saving" }));
    try {
      const r = value
        ? await saveFactAction({ key, value })
        : await clearFactAction({ key });
      if (!r.ok) {
        setErrors((e) => ({ ...e, [key]: [r.message] }));
        setStatus((s) => ({ ...s, [key]: "idle" }));
        return false;
      }
      saved.current[key] = value;
      // FR-6: a changed name or role may call for a re-approval; the server recounts on refresh and the
      // block renders under the role field without a reload (#112's AC-5 run).
      if (key === "name" || key === "role") {
        setReapproved(null);
        router.refresh();
      }
      setErrors((e) => {
        const next = { ...e };
        delete next[key];
        return next;
      });
      setStatus((s) => ({ ...s, [key]: value ? "saved" : "cleared" }));
      return true;
    } catch {
      setErrors((e) => ({ ...e, [key]: [DETAILS_UNREACHABLE] }));
      setStatus((s) => ({ ...s, [key]: "idle" }));
      return false;
    }
  }

  // FR-1: a pre-filled state shows at once and is saved with the next blur or
  // the Done button, like any other value; no save runs on render.

  function warn(key: string, value: string) {
    // SR-1 (D-2860): number, date-of-birth and address parts on every field;
    // the name and health parts on the free-text fields alone.
    const found = detectParticipantData(value).filter(
      (w) =>
        FREE_TEXT_FACT_KEYS.has(key) ||
        (w.kind !== "name" && w.kind !== "health"),
    );
    setWarnings((all) => ({ ...all, [key]: found.map((w) => w.message) }));
  }

  async function setNoTool(on: boolean) {
    const next = { ...values };
    for (const k of NO_TOOL_KEYS) next[k] = on ? NO_TOOL_FACTS[k] : "";
    setValues(next);
    // Save through the same path with the new values in hand.
    for (const k of NO_TOOL_KEYS) {
      const value = on ? NO_TOOL_FACTS[k] : "";
      if (value === (saved.current[k] ?? "")) continue;
      setStatus((s) => ({ ...s, [k]: "saving" }));
      try {
        const r = value
          ? await saveFactAction({ key: k, value })
          : await clearFactAction({ key: k });
        if (r.ok) {
          saved.current[k] = value;
          setStatus((s) => ({ ...s, [k]: value ? "saved" : "cleared" }));
        } else setErrors((e) => ({ ...e, [k]: [r.message] }));
      } catch {
        setErrors((e) => ({ ...e, [k]: [DETAILS_UNREACHABLE] }));
      }
    }
  }

  async function finish() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      for (const q of questions) if (!(await saveKey(q.key))) return;
      let r: Awaited<ReturnType<typeof finishPackAction>> | null = null;
      try {
        r = await Promise.race([
          finishPackAction({ setId }),
          new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), FINISH_REPLY_MS),
          ),
        ]);
      } catch {
        r = null;
      }
      if (!r) {
        setMessage(DETAILS_UNREACHABLE);
        router.refresh();
        return;
      }
      if (!r.ok) {
        setMessage(r.message);
        return;
      }
      setDone(documentCount);
      router.refresh();
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  const labels = Object.fromEntries(
    questions.map((q) => [q.key, DETAILS_FIELDS[q.key]?.label ?? q.question]),
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void finish();
      }}
      noValidate
      data-testid="finish-form"
    >
      <ErrorSummary errors={errors} labels={labels} />
      <p
        className="border-ochre mb-6 rounded-md border p-3 text-sm leading-6"
        data-testid="details-warning"
      >
        {DETAILS_WARNING}
      </p>
      {done !== null ? (
        <p
          role="status"
          className="mb-6 text-lg leading-8"
          data-testid="finish-done"
        >
          {DETAILS_DONE_LINE(done)}
        </p>
      ) : null}
      <fieldset disabled={!live} data-testid="details-fields">
        {questions.map((q) => {
          const copy = DETAILS_FIELDS[q.key];
          const label = copy?.label ?? q.question;
          const help = copy?.help ?? q.example;
          const err = errors[q.key]?.[0];
          const st = status[q.key] ?? "idle";
          const describedBy = [
            `${q.key}-help`,
            err ? `${q.key}-error` : null,
            warnings[q.key]?.length ? `${q.key}-warning` : null,
          ]
            .filter(Boolean)
            .join(" ");
          const readOnly = noTool && NO_TOOL_KEYS.includes(q.key);
          return (
            <div key={q.key} className="mb-6" data-testid={`fact-${q.key}`}>
              <label htmlFor={q.key} className="block text-base font-medium">
                {label}
              </label>
              <p
                id={`${q.key}-help`}
                className="text-slate mt-1 text-sm leading-6"
              >
                {help}
              </p>
              <div className="mt-2 flex items-center gap-3">
                <input
                  id={q.key}
                  name={q.key}
                  type="text"
                  inputMode={q.key === "phone-or-email" ? "email" : "text"}
                  autoComplete={
                    q.key === "name"
                      ? "name"
                      : q.key === "phone-or-email"
                        ? "tel"
                        : "off"
                  }
                  maxLength={200}
                  value={values[q.key] ?? ""}
                  readOnly={readOnly}
                  aria-describedby={describedBy}
                  aria-invalid={err ? true : undefined}
                  onChange={(e) => {
                    const v = e.target.value;
                    setValues((a) => ({ ...a, [q.key]: v }));
                    setStatus((s) => ({ ...s, [q.key]: "idle" }));
                    warn(q.key, v);
                  }}
                  onBlur={() => void saveKey(q.key)}
                  className={`${INPUT} ${err ? "border-red-700 dark:border-red-400" : ""}`}
                />
                <span
                  role="status"
                  className="text-slate min-w-14 text-sm"
                  data-testid={`fact-${q.key}-status`}
                >
                  {st === "saving"
                    ? DETAILS_SAVING
                    : st === "saved"
                      ? DETAILS_SAVED
                      : ""}
                </span>
              </div>
              {st === "cleared" ? (
                <p className="text-slate mt-1 text-sm leading-6">
                  {DETAILS_CLEARED}
                </p>
              ) : null}
              {q.key === "name" || q.key === "role" ? (
                <p
                  className="text-slate mt-1 text-sm leading-6"
                  data-testid={`fact-${q.key}-reapproval`}
                >
                  {DETAILS_REAPPROVAL_LINE}
                </p>
              ) : null}
              {q.key === "role" && (reapprovals > 0 || reapproved !== null) ? (
                <section
                  aria-labelledby="reapprove-heading"
                  className="border-ochre mt-3 rounded-md border p-3"
                  data-testid="reapprove"
                >
                  <h2 id="reapprove-heading" className="text-base font-medium">
                    {DETAILS_REAPPROVE_HEADING}
                  </h2>
                  {reapproved !== null ? (
                    <p
                      role="status"
                      className="mt-1 text-sm leading-6"
                      data-testid="reapproved-line"
                    >
                      {DETAILS_REAPPROVED_LINE(reapproved)}
                    </p>
                  ) : (
                    <>
                      <p className="mt-1 text-sm leading-6">
                        {DETAILS_REAPPROVE_LINE(reapprovals)}
                      </p>
                      <div className="mt-2">
                        <ConfirmButton
                          label={DETAILS_REAPPROVE_BUTTON(reapprovals)}
                          question={DETAILS_REAPPROVE_QUESTION}
                          confirmLabel={DETAILS_REAPPROVE_CONFIRM}
                          confirmClassName="btn-secondary"
                          onConfirm={() => void reapprove()}
                          testId="reapprove-button"
                        />
                      </div>
                    </>
                  )}
                </section>
              ) : null}
              {warnings[q.key]?.length ? (
                <p
                  id={`${q.key}-warning`}
                  role="status"
                  className="border-ochre mt-2 rounded-md border p-3 text-sm leading-6"
                  data-testid={`fact-${q.key}-warning`}
                >
                  {warnings[q.key][0]}
                </p>
              ) : null}
              {err ? (
                <p
                  id={`${q.key}-error`}
                  className="mt-2 text-sm font-medium text-red-700 dark:text-red-400"
                >
                  {err}
                </p>
              ) : null}
              {hasNoTool && q.key === "other-tool" ? (
                <label className="mt-3 flex min-h-11 items-center gap-3 text-base">
                  <input
                    type="checkbox"
                    checked={noTool}
                    onChange={(e) => void setNoTool(e.target.checked)}
                    data-testid="fact-other-tool-none"
                    className="size-5"
                  />
                  {DETAILS_NO_TOOL_LABEL}
                </label>
              ) : null}
            </div>
          );
        })}
      </fieldset>
      <section
        aria-labelledby="details-business-heading"
        className="border-rule mb-6 rounded-md border p-3"
        data-testid="details-business"
      >
        <h2 id="details-business-heading" className="text-base font-medium">
          {DETAILS_READ_ONLY_HEADING}
        </h2>
        <dl className="mt-2 text-sm leading-6">
          <div className="flex gap-3">
            <dt className="text-slate">{DETAILS_BUSINESS_NAME}</dt>
            <dd data-testid="details-business-name">{business.name}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="text-slate">{DETAILS_ABN}</dt>
            <dd data-testid="details-abn">{business.abn ?? DETAILS_NO_ABN}</dd>
          </div>
        </dl>
        <p className="text-slate mt-2 text-sm leading-6">
          {DETAILS_READ_ONLY_HELP}
        </p>
      </section>
      {message ? (
        <p role="alert" className="mt-4 text-sm leading-6">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="btn-primary mt-2"
        data-testid="finish-next"
      >
        {busy ? DETAILS_DONE_BUSY : DETAILS_DONE_BUTTON}
      </button>
    </form>
  );
}
