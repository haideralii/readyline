"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ScreeningExceptionRow } from "@/lib/registers/audit-day-types";
import {
  EXCEPTION_CODE_LABELS,
  OWN_CALL_CODES,
} from "@/lib/registers/exception-forms";
import {
  DECLARATION_ASK,
  DECLARATION_LINE,
  END_CODE_LABELS,
  END_CODES,
  PART4_AFTER_MESSAGE,
  PART4_VIC_HELP,
  SUPERVISOR_SOURCE,
  type EndCode,
  type ExceptionGate,
} from "@/lib/registers/exception-gates";
import { formatLongDay } from "@/lib/registers/state-facts";
import {
  DECISION_CODES,
  type AuState,
  type DecisionCode,
} from "@/lib/registers/types";
import {
  endExceptionAction,
  recordApplicationAction,
  recordDecisionAction,
  recordOwnCallAction,
  startExceptionAction,
  updateProcedureAction,
  type ExceptionActionResult,
} from "@/server/registers/exception-actions";
import { CheckboxField, DateField, SelectField } from "./inputs";

/**
 * The s 14 exception on a worker's page (REQ-024 A2, FR-4, FR-4a; D-2403,
 * D-2411, D-2428, D-2434, D-2439): the application recorded first; the gates
 * read as lines, each one a reason when it fails and never an escape; the
 * start form with its five dates, the cleared supervisor and the
 * declaration tick; a running exception with how it ends; the three own-call
 * codes as a code and dates; "Update the procedure" with its confirm line.
 * Workers are codes. The words never say a worker may start (D-2411).
 */
const STATES: readonly AuState[] = [
  "NSW",
  "VIC",
  "QLD",
  "SA",
  "WA",
  "TAS",
  "ACT",
  "NT",
];

const DECISION_LABELS: Record<DecisionCode, string> = {
  "interim-bar": "interim bar",
  suspended: "suspended",
  revoked: "revoked",
  excluded: "excluded",
  other: "another decision by the unit",
};

export type ExceptionPanelProps = {
  workerRef: string;
  ownerRow: boolean;
  canWrite: boolean;
  today: string;
  gate: ExceptionGate;
  exception: ScreeningExceptionRow | null;
  history: ScreeningExceptionRow[];
  application: {
    id: string;
    application_number: string;
    state: string | null;
    verified_in_database_on: string | null;
    decision_code: string | null;
  } | null;
  plan: { version: number; adopted_on: string } | null;
  /** The newest ready set, for "Update the procedure"; null when the account has none. */
  setId: string | null;
  /** AC-14: the day the supervisor's own clearance ended while the exception runs. */
  supervisorClearanceEndedOn: string | null;
  /** D-2439 (finding 238): the per-state latest day a Part 4 arrangement could run to. */
  part4Ends: Record<string, string | null>;
};

function errorsOf(r: ExceptionActionResult | null, field: string): string[] {
  return r && !r.ok ? (r.fieldErrors?.[field] ?? []) : [];
}

export function ExceptionPanel(p: ExceptionPanelProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<ExceptionActionResult | null>(null);

  async function run(name: string, call: () => Promise<ExceptionActionResult>) {
    setBusy(name);
    setResult(null);
    try {
      const r = await call();
      setResult(r);
      if (r.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  // Record the application.
  const [appNumber, setAppNumber] = useState("");
  const [appState, setAppState] = useState<AuState | "">("");
  const [verifiedOn, setVerifiedOn] = useState(
    p.application?.verified_in_database_on ?? p.today,
  );
  // Start.
  const [supervisor, setSupervisor] = useState<string>(
    p.gate.supervisors[0] ?? "",
  );
  const [noticeSeenOn, setNoticeSeenOn] = useState(p.today);
  const [startedOn, setStartedOn] = useState(p.today);
  const [declarationOn, setDeclarationOn] = useState(p.today);
  const [declaration, setDeclaration] = useState(false);
  // End.
  const [endCode, setEndCode] = useState<EndCode | "">(
    p.supervisorClearanceEndedOn ? "supervisor-clearance-expired" : "",
  );
  const [endedOn, setEndedOn] = useState(
    p.supervisorClearanceEndedOn ?? p.today,
  );
  // Own call.
  const [ownCode, setOwnCode] = useState<(typeof OWN_CALL_CODES)[number] | "">(
    "",
  );
  const [part4State, setPart4State] = useState<AuState | "">("");
  const [ownStart, setOwnStart] = useState("");
  const [ownEnd, setOwnEnd] = useState("");
  const [ownEndCode, setOwnEndCode] = useState<EndCode | "">("");
  // Decision.
  const [decision, setDecision] = useState<DecisionCode | "">("");
  const [decisionOn, setDecisionOn] = useState(p.today);

  const message = result && !result.ok ? result.message : null;
  // Every refusal is legible on the page: the form errors and any field error
  // the panel has no field for, so a reader (and CI's log) sees why.
  const formErrors =
    result && !result.ok
      ? [
          ...(result.formErrors ?? []),
          ...Object.entries(result.fieldErrors ?? {}).flatMap(([k, v]) =>
            v.map((e) => `${k}: ${e}`),
          ),
        ]
      : [];

  return (
    <section
      aria-labelledby="exception-heading"
      className="mt-8"
      data-testid="exception-panel"
    >
      <h2 id="exception-heading" className="text-lg font-semibold">
        Starting before the clearance: the s 14 exception
      </h2>
      <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        Worker Screening Rules s 14(1)(a) and s 15. Readyline records what you
        did and when; the unit&apos;s database and you decide.
      </p>

      {message ? (
        <div
          role="alert"
          className="mt-3 rounded-md border border-red-700 p-3 text-sm leading-6 dark:border-red-400"
          data-testid="exception-message"
        >
          <p>{message}</p>
          {formErrors.length > 0 ? (
            <ul className="mt-1 list-disc pl-5">
              {formErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {result?.ok ? (
        <p
          role="status"
          className="mt-3 text-sm leading-6"
          data-testid="exception-saved"
        >
          Saved.
        </p>
      ) : null}

      {p.exception ? (
        <div
          className="mt-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
          data-testid="exception-running"
        >
          <p className="font-medium">
            Running since {formatLongDay(p.exception.started_on)} (
            {EXCEPTION_CODE_LABELS[p.exception.code].split(":")[0]})
          </p>
          <ul className="mt-2 space-y-1 text-sm leading-6">
            {p.exception.verified_on ? (
              <li>
                Confirmed to the unit in the database on{" "}
                {formatLongDay(p.exception.verified_on)}; notice seen on{" "}
                {formatLongDay(
                  p.exception.notice_seen_on ?? p.exception.verified_on,
                )}
                .
              </li>
            ) : null}
            {p.exception.supervisor_ref ? (
              <li>
                Supervised by {p.exception.supervisor_ref} (holds a current
                clearance).
              </li>
            ) : null}
            {p.exception.plan_register_date ? (
              <li>
                Under our Division 3 plan
                {p.plan
                  ? `, version ${p.plan.version} adopted ${formatLongDay(p.plan.adopted_on)}`
                  : ""}
                , the register current to{" "}
                {formatLongDay(p.exception.plan_register_date)}.
              </li>
            ) : null}
            {p.exception.declaration_on ? (
              <li>
                Declaration under s 15(2)(a) and (b) given on{" "}
                {formatLongDay(p.exception.declaration_on)}.
              </li>
            ) : null}
          </ul>
          {p.supervisorClearanceEndedOn ? (
            <p
              className="border-ochre mt-3 rounded-md border p-3 text-sm leading-6"
              data-testid="supervisor-ended-line"
            >
              Supervisor&apos;s clearance expired on{" "}
              {formatLongDay(p.supervisorClearanceEndedOn)}. The exception ended
              that day (s 15(2)(f)); record the end with that date.
            </p>
          ) : null}
          {p.canWrite ? (
            <form
              noValidate
              className="mt-3"
              data-testid="end-exception-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run("end", () =>
                  endExceptionAction({
                    exceptionId: p.exception!.id,
                    endCode,
                    endedOn,
                  }),
                );
              }}
            >
              <SelectField
                id="end-code"
                label="How it ended"
                errors={errorsOf(result, "endCode")}
                value={endCode}
                onChange={setEndCode}
                options={END_CODES.map((c) => ({
                  value: c,
                  label: END_CODE_LABELS[c],
                }))}
              />
              <DateField
                id="ended-on"
                label="Day it ended"
                errors={errorsOf(result, "endedOn")}
                value={endedOn}
                onChange={setEndedOn}
                max={p.today}
              />
              <button
                type="submit"
                className="btn-primary"
                disabled={busy !== null}
                aria-busy={busy === "end" || undefined}
                data-testid="end-exception"
              >
                {busy === "end" ? "Saving…" : "Record the end"}
              </button>
            </form>
          ) : null}
        </div>
      ) : (
        <>
          {!p.application && p.canWrite ? (
            <form
              noValidate
              className="mt-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
              data-testid="record-application-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run("application", () =>
                  recordApplicationAction({
                    workerRef: p.workerRef,
                    applicationNumber: appNumber,
                    state: appState,
                    verifiedOn,
                  }),
                );
              }}
            >
              <p className="mb-3 font-medium">Record the application first</p>
              <p className="mb-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                From the unit&apos;s written notice: the application number, the
                state it was submitted in, and the day you confirmed the
                application in the NDIS Worker Screening Database (s 15(3) and
                (4)).
              </p>
              <div className="mb-6">
                <label
                  htmlFor="application-number"
                  className="block text-base font-medium"
                >
                  Application number
                </label>
                <input
                  id="application-number"
                  name="application-number"
                  type="text"
                  value={appNumber}
                  onChange={(e) => setAppNumber(e.target.value)}
                  autoComplete="off"
                  maxLength={40}
                  aria-invalid={
                    errorsOf(result, "applicationNumber").length > 0 ||
                    undefined
                  }
                  className="mt-2 block min-h-12 w-full max-w-60 rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-base dark:border-zinc-700 dark:bg-zinc-950"
                />
                {errorsOf(result, "applicationNumber").map((e) => (
                  <p
                    key={e}
                    className="mt-1 text-sm text-red-700 dark:text-red-400"
                  >
                    {e}
                  </p>
                ))}
              </div>
              <SelectField
                id="application-state"
                label="State the application was submitted in"
                errors={errorsOf(result, "state")}
                value={appState}
                onChange={setAppState}
                options={STATES.map((s) => ({ value: s, label: s }))}
              />
              <DateField
                id="verified-on"
                label="Day you confirmed it in the database"
                errors={errorsOf(result, "verifiedOn")}
                value={verifiedOn}
                onChange={setVerifiedOn}
                max={p.today}
              />
              <button
                type="submit"
                className="btn-primary"
                disabled={busy !== null}
                aria-busy={busy === "application" || undefined}
                data-testid="record-application"
              >
                {busy === "application" ? "Saving…" : "Record the application"}
              </button>
            </form>
          ) : null}

          {p.gate.offered ? (
            <form
              noValidate
              className="mt-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
              data-testid="start-exception-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run("start", () =>
                  startExceptionAction({
                    workerRef: p.workerRef,
                    supervisorRef: supervisor,
                    verifiedOn,
                    noticeSeenOn,
                    startedOn,
                    declarationOn,
                    declaration,
                  }),
                );
              }}
            >
              <p className="font-medium">What this records</p>
              <ol
                className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6"
                data-testid="exception-lines"
              >
                <li>{p.gate.lines.confirmed}</li>
                <li>{p.gate.lines.supervised}</li>
                <li>{p.gate.lines.plan}</li>
                <li>{p.gate.lines.states}</li>
              </ol>
              <div className="mt-4">
                <SelectField
                  id="supervisor-ref"
                  label="Supervised by"
                  help="A worker in your account whose clearance you have checked in the database."
                  errors={errorsOf(result, "supervisorRef")}
                  value={supervisor}
                  onChange={setSupervisor}
                  options={p.gate.supervisors.map((s) => ({
                    value: s,
                    label: `${s} (holds a current clearance)`,
                  }))}
                />
                <DateField
                  id="start-verified-on"
                  label="Day you confirmed the application in the database"
                  errors={errorsOf(result, "verifiedOn")}
                  value={verifiedOn}
                  onChange={setVerifiedOn}
                  max={p.today}
                />
                <DateField
                  id="notice-seen-on"
                  label="Day you saw the unit's written notice"
                  errors={errorsOf(result, "noticeSeenOn")}
                  value={noticeSeenOn}
                  onChange={setNoticeSeenOn}
                  max={p.today}
                />
                <DateField
                  id="declaration-on"
                  label="Day the worker gave the written declaration"
                  errors={errorsOf(result, "declarationOn")}
                  value={declarationOn}
                  onChange={setDeclarationOn}
                  max={p.today}
                />
                <DateField
                  id="started-on"
                  label="Day the worker starts under the exception"
                  errors={errorsOf(result, "startedOn")}
                  value={startedOn}
                  onChange={setStartedOn}
                />
                <CheckboxField
                  id="declaration"
                  label={DECLARATION_LINE}
                  help={DECLARATION_ASK}
                  checked={declaration}
                  onChange={setDeclaration}
                />
              </div>
              <button
                type="submit"
                className="btn-primary"
                disabled={busy !== null || !p.canWrite}
                aria-busy={busy === "start" || undefined}
                data-testid="start-exception"
              >
                {busy === "start" ? "Saving…" : "Record the exception"}
              </button>
            </form>
          ) : (
            <div
              className="mt-3 rounded-md border border-zinc-200 p-3 text-sm leading-6 dark:border-zinc-800"
              data-testid="exception-reasons"
            >
              <p className="font-medium">
                The s 14 exception is not available for this worker yet:
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {p.gate.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                Source: {SUPERVISOR_SOURCE}.
              </p>
            </div>
          )}
        </>
      )}

      {p.application && !p.application.decision_code && p.canWrite ? (
        <details className="mt-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
          <summary className="cursor-pointer font-medium">
            The unit made a decision about this application
          </summary>
          <form
            noValidate
            className="mt-3"
            data-testid="record-decision-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run("decision", () =>
                recordDecisionAction({
                  clearanceId: p.application!.id,
                  decisionCode: decision,
                  decisionOn,
                }),
              );
            }}
          >
            <p className="mb-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              A code and a date, never the reason: the unit&apos;s letter is
              your s 18(4) copy in the HR file.
            </p>
            <SelectField
              id="decision-code"
              label="The decision"
              errors={errorsOf(result, "decisionCode")}
              value={decision}
              onChange={setDecision}
              options={DECISION_CODES.map((c) => ({
                value: c,
                label: DECISION_LABELS[c],
              }))}
            />
            <DateField
              id="decision-on"
              label="Day of the decision"
              errors={errorsOf(result, "decisionOn")}
              value={decisionOn}
              onChange={setDecisionOn}
              max={p.today}
            />
            <button
              type="submit"
              className="btn-secondary"
              disabled={busy !== null}
              data-testid="record-decision"
            >
              {busy === "decision" ? "Saving…" : "Record the decision"}
            </button>
          </form>
        </details>
      ) : null}

      {p.canWrite ? (
        <details
          className="mt-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
          data-testid="own-call-details"
        >
          <summary className="cursor-pointer font-medium">
            Record another s 14 exception (your own call)
          </summary>
          <form
            noValidate
            className="mt-3"
            data-testid="own-call-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run("own-call", () =>
                recordOwnCallAction({
                  workerRef: p.workerRef,
                  code: ownCode,
                  part4State,
                  startedOn: ownStart,
                  endedOn: ownEnd,
                  endCode: ownEndCode,
                }),
              );
            }}
          >
            <p className="mb-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Readyline gates s 14(1)(a) and (2)(a) above. The other three are
              your own call, recorded as a code and dates for your s 18 list.
            </p>
            <SelectField
              id="own-code"
              label="Which exception"
              errors={errorsOf(result, "code")}
              value={ownCode}
              onChange={setOwnCode}
              options={OWN_CALL_CODES.map((c) => ({
                value: c,
                label: EXCEPTION_CODE_LABELS[c],
              }))}
            />
            {ownCode === "s14-1b" || ownCode === "s14-2b" ? (
              <>
                <SelectField
                  id="part4-state"
                  label="State whose Part 4 section applied"
                  help={
                    <>
                      Every Part 4 arrangement has ended by its own date; s 29B
                      ceased at the end of 1 February 2024 (s 29B(10)).{" "}
                      {PART4_AFTER_MESSAGE}.
                      {part4State && p.part4Ends[part4State]
                        ? ` ${part4State}: the Rules' own years ran out on ${formatLongDay(p.part4Ends[part4State]!)}.`
                        : ""}
                      {part4State === "VIC" ? ` ${PART4_VIC_HELP}` : ""}
                      {part4State === "QLD"
                        ? " QLD: about three years from the card held at 31 January 2021, unverified until the yellow card's term is read."
                        : ""}
                    </>
                  }
                  errors={errorsOf(result, "part4State")}
                  value={part4State}
                  onChange={setPart4State}
                  options={STATES.map((s) => ({ value: s, label: s }))}
                />
              </>
            ) : null}
            <DateField
              id="own-started-on"
              label="Day it started"
              errors={errorsOf(result, "startedOn")}
              value={ownStart}
              onChange={setOwnStart}
            />
            <DateField
              id="own-ended-on"
              label="Day it ended"
              errors={errorsOf(result, "endedOn")}
              value={ownEnd}
              onChange={setOwnEnd}
              optional
            />
            <SelectField
              id="own-end-code"
              label="How it ended (optional)"
              errors={errorsOf(result, "endCode")}
              value={ownEndCode}
              onChange={setOwnEndCode}
              options={END_CODES.map((c) => ({
                value: c,
                label: END_CODE_LABELS[c],
              }))}
              placeholder="Still running"
            />
            <button
              type="submit"
              className="btn-secondary"
              disabled={busy !== null}
              data-testid="record-own-call"
            >
              {busy === "own-call" ? "Saving…" : "Record it"}
            </button>
          </form>
        </details>
      ) : null}

      {p.setId && p.canWrite ? (
        <details
          className="mt-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
          data-testid="update-procedure-details"
        >
          <summary className="cursor-pointer font-medium">
            Update the procedure with the participant risk register
          </summary>
          <p
            className="mt-2 text-sm leading-6"
            data-testid="update-procedure-confirm"
          >
            The register&apos;s rows, by code, will appear in the
            procedure&apos;s text and go wherever the procedure goes: to your
            workers when you walk them through it, and to the auditor in your
            pack. The procedure becomes a new version for you to adopt.
          </p>
          <button
            type="button"
            className="btn-secondary mt-3"
            disabled={busy !== null}
            aria-busy={busy === "update" || undefined}
            data-testid="update-procedure"
            onClick={() =>
              void run("update", () =>
                updateProcedureAction({ setId: p.setId! }),
              )
            }
          >
            {busy === "update" ? "Updating…" : "Update the procedure"}
          </button>
        </details>
      ) : null}

      {p.history.filter((h) => h.ended_on).length ? (
        <div className="mt-3" data-testid="exception-history">
          <p className="text-sm font-medium">Earlier exceptions</p>
          <ul className="mt-1 space-y-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            {p.history
              .filter((h) => h.ended_on)
              .map((h) => (
                <li key={h.id}>
                  {EXCEPTION_CODE_LABELS[h.code].split(":")[0]}
                  {h.part4_state ? ` (${h.part4_state})` : ""}:{" "}
                  {formatLongDay(h.started_on)} to {formatLongDay(h.ended_on!)}
                  {h.end_code ? `; ${END_CODE_LABELS[h.end_code]}` : ""}
                  {h.supervisor_ref
                    ? `; supervised by ${h.supervisor_ref}`
                    : ""}
                  .
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
