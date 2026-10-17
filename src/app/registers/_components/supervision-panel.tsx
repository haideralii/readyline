"use client";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import type { SupervisionEntryRow } from "@/lib/registers/audit-day-types";
import {
  kindLabel,
  PROBATION_OUTCOME_LABELS,
  PROBATION_OUTCOMES,
  SUPERVISION_INTRO,
  SUPERVISION_KIND_LABELS,
  SUPERVISION_KINDS,
  SUPERVISION_NOTE_HELP,
  SUPERVISION_NOTE_MAX,
  sortEntries,
  supervisionEntryLine,
  type ProbationOutcome,
  type SupervisionKind,
} from "@/lib/registers/supervision";
import { formatLongDay } from "@/lib/registers/state-facts";
import {
  addSupervisionEntryAction,
  type SupervisionActionResult,
} from "@/server/registers/supervision-actions";
import {
  DateField,
  RefField,
  RegisterParticipantLine,
  SafeTextArea,
  SelectField,
} from "./inputs";

/**
 * A worker's supervision history on the owner's worker page (REQ-024
 * Session C, FR-11; D-2829, D-2833; finding 78): the entries newest first,
 * each with its kind, day and the supervisor's code (a review with its
 * outcome), and one form: the kind, the day (today at most), the
 * supervisor's code, and the note with the lawyer's helper and the
 * participant warning, or the outcome when the kind is a probation review.
 * Workers and supervisors are codes. Entries are added, never edited.
 */
export type SupervisionPanelProps = {
  workerRef: string;
  entries: SupervisionEntryRow[];
  /** The staff row's `last_supervision_on`, the date the reminder reads. */
  lastSupervisionOn: string | null;
  canWrite: boolean;
  today: string;
  /** The owner's own code when their row is linked, offered as the supervisor's default. */
  ownerRef: string | null;
};

const KIND_OPTIONS = SUPERVISION_KINDS.map((k) => ({
  value: k,
  label: SUPERVISION_KIND_LABELS[k],
}));
const OUTCOME_OPTIONS = PROBATION_OUTCOMES.map((o) => ({
  value: o,
  label: PROBATION_OUTCOME_LABELS[o],
}));

function errorsOf(r: SupervisionActionResult | null, field: string): string[] {
  return r && !r.ok ? (r.fieldErrors?.[field] ?? []) : [];
}

export function SupervisionPanel(p: SupervisionPanelProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SupervisionActionResult | null>(null);
  const [kind, setKind] = useState<SupervisionKind | "">("supervision");
  const [heldOn, setHeldOn] = useState(p.today);
  const [byRef, setByRef] = useState(p.ownerRef ?? "");
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState<ProbationOutcome | "">("");
  // D-1012's rule: inert until React is live, so a click never submits natively.
  const live = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const review = kind === "probation-review";
  const history = sortEntries(p.entries);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const r = await addSupervisionEntryAction({
        workerRef: p.workerRef,
        kind,
        heldOn,
        byRef,
        note: review ? "" : note,
        outcome: review ? outcome : "",
      });
      setResult(r);
      if (r.ok) {
        setNote("");
        setOutcome("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="mt-8"
      aria-labelledby="supervision-heading"
      data-testid="supervision-panel"
    >
      <h2 id="supervision-heading" className="text-lg font-semibold">
        Supervision
      </h2>
      <p className="text-slate mt-1 text-sm leading-6">{SUPERVISION_INTRO}</p>
      <p className="mt-2 text-sm leading-6" data-testid="supervision-last">
        {p.lastSupervisionOn
          ? `Last supervision contact ${formatLongDay(p.lastSupervisionOn)}.`
          : "No supervision recorded yet."}
      </p>
      {history.length ? (
        <ol className="mt-3 space-y-2" data-testid="supervision-history">
          {history.map((e) => (
            <li
              key={e.id}
              className="border-line rounded-md border p-3 text-sm leading-6"
              data-testid={`supervision-entry-${e.id}`}
              data-kind={e.kind}
            >
              <p className="font-medium">{supervisionEntryLine(e)}</p>
              {e.note ? (
                <p className="text-slate mt-1 [overflow-wrap:anywhere]">
                  {e.note}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-slate mt-3 text-sm" data-testid="supervision-none">
          No entries yet. The first one you add sets the date above.
        </p>
      )}
      {p.canWrite ? (
        <form
          className="border-line mt-5 rounded-md border p-3"
          data-testid="supervision-form"
          onSubmit={submit}
        >
          <h3 className="text-base font-semibold">Add an entry</h3>
          <RegisterParticipantLine />
          <fieldset disabled={!live || busy} className="mt-3 space-y-4">
            <SelectField
              id="supervision-kind"
              label="Kind of entry"
              errors={errorsOf(result, "kind")}
              value={kind}
              onChange={(v) => {
                setKind(v);
                if (v !== "probation-review") setOutcome("");
              }}
              options={KIND_OPTIONS}
              placeholder="Choose the kind"
            />
            <DateField
              id="supervision-held-on"
              label="Held on"
              errors={errorsOf(result, "heldOn")}
              value={heldOn}
              onChange={setHeldOn}
              max={p.today}
              help="Today at most; record a session once it has happened."
            />
            <RefField
              id="supervision-by-ref"
              label="Who held it"
              hint="KP-1 or W-002"
              errors={errorsOf(result, "byRef")}
              value={byRef}
              onChange={setByRef}
              optional={false}
            />
            {review ? (
              <SelectField
                id="supervision-outcome"
                label="Outcome"
                help="A probation review records its outcome and no note."
                errors={errorsOf(result, "outcome")}
                value={outcome}
                onChange={setOutcome}
                options={OUTCOME_OPTIONS}
                placeholder="Choose the outcome"
              />
            ) : (
              <SafeTextArea
                id="supervision-note"
                label="What was covered"
                help={SUPERVISION_NOTE_HELP}
                errors={errorsOf(result, "note")}
                value={note}
                onChange={setNote}
                maxLength={SUPERVISION_NOTE_MAX}
                rows={3}
                optional
              />
            )}
            <button
              type="submit"
              className="btn-primary"
              data-testid="supervision-save"
            >
              {busy ? "Saving…" : "Add the entry"}
            </button>
          </fieldset>
          {result && !result.ok ? (
            <p
              role="alert"
              className="mt-3 text-sm text-red-700 dark:text-red-400"
              data-testid="supervision-message"
            >
              {result.message}
              {result.formErrors?.length
                ? ` ${result.formErrors.join(" ")}`
                : ""}
            </p>
          ) : null}
          {result?.ok ? (
            <p
              role="status"
              className="text-moss mt-3 text-sm"
              data-testid="supervision-saved"
            >
              ✓ Added. {kindLabel(kind)} on {formatLongDay(heldOn)}.
            </p>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
