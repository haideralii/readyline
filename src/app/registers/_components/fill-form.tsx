/**
 * REQ-024 Session A3, the export screen's form (FR-6b; SR-8(b), (h), (i),
 * (k)). A plain form with no hooks, so the page renders it inside the client
 * wrapper (the checkbox, the ten-minute clear) and a refused submission's
 * response renders it again with the typed values still in the fields, as
 * static markup (finding 76). Every field has `autocomplete="off"`; nothing
 * here is a server action and nothing is stored.
 */
import {
  EXPORT_SCREEN_PATH,
  FILL_COPY,
  FILL_LIMITS,
  FILL_PATHS,
  NOTICE_PATH,
} from "@/lib/registers/fill";
import type { WorkerFill } from "@/lib/registers/worker-exports";

export type FillFormValues = {
  fill: boolean;
  told: boolean;
  asAt: string;
  values: WorkerFill;
};

export const EMPTY_FILL_VALUES: FillFormValues = {
  fill: false,
  told: false,
  asAt: "",
  values: { workers: {}, supervisors: {} },
};

const input =
  "border-line bg-surface text-ink mt-1 block w-full min-h-11 rounded-md border px-3 py-2 text-base focus:outline-2 focus:outline-offset-2";

export function FillFormFields({
  codes,
  pastCodes,
  supervisorRefs,
  assessorDefault,
  state,
  message,
  onFillChange,
}: {
  /** Current worker codes, then past ones. */
  codes: readonly string[];
  pastCodes: readonly string[];
  /** The supervising workers named by an exception (s 18(3)(c)(iii)). */
  supervisorRefs: readonly string[];
  /** The owner's own name from the account facts (D-2409), typed over if wrong. */
  assessorDefault: string;
  state: FillFormValues;
  message?: string;
  onFillChange?: (fill: boolean) => void;
}) {
  const { fill, told, asAt, values } = state;
  const assessor = values.assessor_name ?? assessorDefault;
  return (
    <div data-testid="fill-form">
      {message ? (
        <p
          role="alert"
          className="border-signal text-signal mt-4 rounded-md border p-3 text-sm leading-6"
          data-testid="fill-message"
        >
          {message}
        </p>
      ) : null}

      <div className="mt-6">
        <label htmlFor="as_at" className="block font-medium">
          As at
        </label>
        <p className="text-slate mt-1 text-sm leading-6">
          The day the lists speak for; today unless you are rebuilding an
          earlier list (Rules s 20).
        </p>
        <input
          id="as_at"
          name="as_at"
          type="date"
          defaultValue={asAt}
          autoComplete="off"
          className={`${input} max-w-xs`}
        />
      </div>

      <div className="border-rule mt-6 rounded-md border p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="fill"
            value="on"
            defaultChecked={fill}
            onChange={
              onFillChange ? (e) => onFillChange(e.target.checked) : undefined
            }
            className="mt-1 h-5 w-5 shrink-0"
            data-testid="fill-checkbox"
          />
          <span>{FILL_COPY.checkbox}</span>
        </label>
        <p
          className="text-slate mt-3 text-sm leading-6"
          data-testid="fill-owner-notice"
        >
          {FILL_COPY.ownerNotice} {FILL_COPY.app36b}{" "}
          <a
            href={NOTICE_PATH}
            className="underline underline-offset-2"
            data-testid="fill-notice-link"
          >
            Open the printable notice
          </a>
          .
        </p>
      </div>

      <div hidden={!fill} data-testid="fill-fields">
        <p className="mt-6 font-medium" data-testid="fill-workers-only">
          {FILL_COPY.workersOnly}
        </p>
        <label className="mt-4 flex items-start gap-3">
          <input
            type="checkbox"
            name="told"
            value="on"
            defaultChecked={told}
            required={fill}
            className="mt-1 h-5 w-5 shrink-0"
            data-testid="fill-told"
          />
          <span>{FILL_COPY.tick}</span>
        </label>
        <ul className="mt-4 space-y-4">
          {[...codes, ...pastCodes].map((code) => {
            const w = values.workers[code] ?? {};
            const past = pastCodes.includes(code);
            return (
              <li
                key={code}
                className="border-rule rounded-md border p-3"
                data-testid={`fill-row-${code}`}
              >
                <p className="font-medium">
                  {code}
                  {past ? (
                    <span className="text-slate ml-2 text-sm">past worker</span>
                  ) : null}
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  <label className="block text-sm">
                    Full name
                    <input
                      name={`name:${code}`}
                      defaultValue={w.full_name ?? ""}
                      maxLength={FILL_LIMITS.name}
                      autoComplete="off"
                      className={input}
                    />
                  </label>
                  <label className="block text-sm">
                    Date of birth
                    <input
                      name={`dob:${code}`}
                      type="date"
                      defaultValue={w.date_of_birth ?? ""}
                      autoComplete="off"
                      className={input}
                    />
                  </label>
                  <label className="block text-sm">
                    Address
                    <input
                      name={`address:${code}`}
                      defaultValue={w.address ?? ""}
                      maxLength={FILL_LIMITS.address}
                      autoComplete="off"
                      className={input}
                    />
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
        {supervisorRefs.length ? (
          <div className="mt-4">
            <p className="font-medium">Supervising workers (s 18(3)(c)(iii))</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {supervisorRefs.map((ref) => (
                <label key={ref} className="block text-sm">
                  {ref}, full name
                  <input
                    name={`supervisor:${ref}`}
                    defaultValue={values.supervisors[ref] ?? ""}
                    maxLength={FILL_LIMITS.name}
                    autoComplete="off"
                    className={input}
                  />
                </label>
              ))}
            </div>
          </div>
        ) : null}
        <label className="mt-4 block text-sm">
          Assessor, name and title (s 17)
          <input
            name="assessor_name"
            defaultValue={assessor}
            maxLength={FILL_LIMITS.name}
            autoComplete="off"
            className={input}
            data-testid="fill-assessor"
          />
        </label>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="submit"
          formAction={FILL_PATHS["screening-list"]}
          className="btn-primary"
          data-testid="fill-download-screening-list"
        >
          Download the screening list (s 18)
        </button>
        <button
          type="submit"
          formAction={FILL_PATHS["risk-assessed-roles"]}
          className="btn-secondary"
          data-testid="fill-download-roles"
        >
          Download the roles list (s 17)
        </button>
        <button
          type="submit"
          formAction={FILL_PATHS.workers}
          className="btn-secondary"
          data-testid="fill-download-workers"
        >
          Download the worker files (zip)
        </button>
      </div>
      <p className="text-slate mt-3 text-sm leading-6">
        A file is built from what is on this screen when you press the button
        and is sent to you once. Readyline keeps no copy; the fields clear when
        you leave this page or ten minutes after your last keystroke. The
        owner&apos;s pack and the auditor&apos;s link carry these files with
        codes and numbers only.{" "}
        <a href={EXPORT_SCREEN_PATH} className="underline underline-offset-2">
          Start again
        </a>
        .
      </p>
    </div>
  );
}
