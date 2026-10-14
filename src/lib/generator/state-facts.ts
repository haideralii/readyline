/**
 * State and territory facts for the prompt (NDIS watch 13 October 2026,
 * item A1; batch 35, D-1801). The three state-tailored sections and the
 * training matrix used to be written from the model's memory, which named
 * Tasmania's old authoriser. Now `data/state-reference.json` is the only
 * source: the prompt carries a STATE FACTS block for the provider's states,
 * each line with its source and status, and the briefs say that a state or
 * fact missing from the block becomes the "[state]" blank, never a body or
 * a law from memory. Pure: JSON in, text out.
 */
import reference from "../../../data/state-reference.json";
import { STATE_NAMES } from "./facts";

export type StateFact = {
  text: string;
  status: "verified" | "unverified";
  source: { title: string; url: string; readAt: string };
};

/** The approved facts (A1, A2, A7); mandatory reporting and first aid (A9) were not approved and are not here. */
export const STATE_FACT_FIELDS = [
  "workerScreening",
  "childrenCheck",
  "restrictivePractice",
] as const;
export type StateFactField = (typeof STATE_FACT_FIELDS)[number];

export type StateEntry = { name: string } & Record<StateFactField, StateFact>;

export type StateReference = {
  note: string;
  readAt: string;
  national: Record<string, StateFact>;
  states: Record<string, StateEntry>;
};

export const STATE_REFERENCE = reference as StateReference;

/** The tailored sections whose prompt carries the block (the three state-tailored briefs plus the training matrix for A7). */
export const STATE_FACT_SECTIONS: ReadonlySet<string> = new Set([
  "state-authorisation",
  "state-reporting",
  "retention-schedule",
  "training-matrix",
]);

const FIELD_LABELS: Record<StateFactField, string> = {
  workerScreening: "NDIS worker screening",
  childrenCheck: "Children's or vulnerable-people check",
  restrictivePractice: "Restrictive practice authorisation",
};

const NATIONAL_LABELS: Record<string, string> = {
  ndisCheck: "NDIS Worker Screening Check (national)",
};

function line(label: string, f: StateFact): string {
  return `- ${label}: ${f.text} (source: ${f.source.title}, ${f.source.url}, read ${f.source.readAt}; ${f.status})`;
}

export type StateFactLines = { code: string; name: string; lines: string[] };

/** The block entries for the provider's states, given by full name as the facts carry them; unknown names render nothing. */
export function stateFactsFor(stateNames: readonly string[]): StateFactLines[] {
  const codeByName = new Map(
    Object.entries(STATE_NAMES).map(([code, name]) => [name, code]),
  );
  const out: StateFactLines[] = [];
  for (const name of stateNames) {
    const code = codeByName.get(name) ?? name;
    const entry = STATE_REFERENCE.states[code];
    if (!entry) continue;
    out.push({
      code,
      name: entry.name,
      lines: [
        `${entry.name} (${code}):`,
        ...STATE_FACT_FIELDS.map((field) =>
          line(FIELD_LABELS[field], entry[field]),
        ),
      ],
    });
  }
  return out;
}

/** The whole block body: the national facts once, then each state. */
export function renderStateFacts(entries: readonly StateFactLines[]): string {
  const national = Object.entries(STATE_REFERENCE.national).map(([key, f]) =>
    line(NATIONAL_LABELS[key] ?? key, f),
  );
  return [
    "National:",
    ...national,
    ...entries.flatMap((e) => ["", ...e.lines]),
  ].join("\n");
}
