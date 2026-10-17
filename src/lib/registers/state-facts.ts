/**
 * Worker onboarding's read of `data/state-reference.json` (REQ-024 FR-2a;
 * D-2404 as amended, D-2418, D-2426): the one state file, extended with the
 * screening unit's rules on pending work, the combined schemes and the
 * children's check term, and a national block with the Part 4 section and
 * the date each arrangement ended, per state served. Every fact is judged
 * at request time against its own `readAt` with the request's Sydney
 * `today`: a fact with no read date, or one older than six months, is not
 * shown as a state fact and falls back to the national wording. The
 * generator's reader (`src/lib/generator/state-facts.ts`, REQ-005) keeps its
 * own status rule and is untouched by this module (finding 113). Pure: JSON
 * in, text out; nothing here reads the clock.
 */
import reference from "../../../data/state-reference.json";
import { daysBetween } from "./status";

export type FactStatus = "verified" | "unverified";
export type FactSource = { title: string; url: string; readAt: string };
export type UnitFact = { text: string; status: FactStatus; source: FactSource };

/** The two states where one registration carries the children's check and the NDIS clearance, the one where one application does, and the rest. */
export type CombinedScheme =
  "one-registration" | "one-application" | "separate";

export type ScreeningEntry = {
  text: string;
  status: FactStatus;
  source: FactSource;
  /** s 14(1)(a)(iv): the law of the state where the work is done allows pending work (the unit's own words). */
  pendingWorkAllowed?: UnitFact & { allowed: boolean };
  /** s 14A(1)(b): the law of the state the application was submitted in prohibits pending work. */
  applicationProhibitsPending?: UnitFact & { prohibits: boolean };
  /** The unit's stated window for the employer's database verification, where one is stated; null where none is. */
  verificationWindow?: (UnitFact & { days: number }) | null;
  combinedScheme?: UnitFact & { scheme: CombinedScheme };
};

export type ChildrenEntry = {
  text: string;
  status: FactStatus;
  source: FactSource;
  /** The check's term in years, as the file's text states it; null where the unit page did not say. */
  termYears?: number | null;
};

export type StateEntry = {
  name: string;
  workerScreening: ScreeningEntry;
  childrenCheck: ChildrenEntry;
  restrictivePractice: { text: string; status: FactStatus; source: FactSource };
};

export type Part4Line = { section: string; endedOn: string };

export type AcceptableChecks = UnitFact & {
  byState: Record<string, Part4Line>;
};

export type StateReferenceFile = {
  note: string;
  readAt: string;
  national: Record<string, UnitFact> & { acceptableChecks?: AcceptableChecks };
  /** The per-state latest day a Part 4 arrangement could run to, for the (1)(b) code's help text (D-2439; finding 238). */
  part4Ends?: UnitFact & { byState: Record<string, string> };
  states: Record<string, StateEntry>;
};

export const STATE_FILE = reference as unknown as StateReferenceFile;

/** D-2404 as amended: a read older than this is not shown as a state fact. */
export const STALE_AFTER_DAYS = 183;

/** The national fallback a stale or missing unit read gives way to. */
export const CHECK_YOUR_UNIT = "check your state's unit";
/** The national block's own fallback (finding 187). */
export const CHECK_PART_4 = "check the Rules' Part 4 and your unit";

/** True when the read is missing or older than six months at `today` (D-2404; findings 55 and 59). */
export function isStale(
  readAt: string | undefined | null,
  today: string,
): boolean {
  if (!readAt || !/^\d{4}-\d{2}-\d{2}$/.test(readAt)) return true;
  return daysBetween(readAt, today) > STALE_AFTER_DAYS;
}

/** A unit fact is live when it is verified and its read is fresh at `today`. */
export function isLive(
  fact: UnitFact | undefined | null,
  today: string,
): boolean {
  return (
    Boolean(fact) &&
    fact!.status === "verified" &&
    !isStale(fact!.source.readAt, today)
  );
}

export type ScreeningFacts = {
  code: string;
  name: string;
  /** null when the read is missing, unverified or stale: the item says "check your state's unit". */
  pendingWorkAllowed: boolean | null;
  pendingLine: string;
  applicationProhibitsPending: boolean | null;
  prohibitsLine: string;
  combinedScheme: CombinedScheme | null;
  combinedLine: string;
  childrenTermYears: number | null;
  sources: FactSource[];
};

const NATIONAL_PENDING = `Whether you may start this worker before the clearance arrives depends on your state's law; ${CHECK_YOUR_UNIT}.`;

/** The screening facts for one state at `today`, each line falling back to the national wording where the read is not live. */
export function screeningFactsFor(
  code: string,
  today: string,
): ScreeningFacts | null {
  const s = STATE_FILE.states[code];
  if (!s) return null;
  const ws = s.workerScreening;
  const sources: FactSource[] = [];
  const pending = ws.pendingWorkAllowed;
  const pendingLive = isLive(pending, today);
  if (pendingLive) sources.push(pending!.source);
  const prohibits = ws.applicationProhibitsPending;
  const prohibitsLive = isLive(prohibits, today);
  if (prohibitsLive) sources.push(prohibits!.source);
  const combined = ws.combinedScheme;
  const combinedLive = isLive(combined, today);
  if (combinedLive) sources.push(combined!.source);
  const childrenLive =
    !isStale(s.childrenCheck.source.readAt, today) &&
    s.childrenCheck.status === "verified";
  return {
    code,
    name: s.name,
    pendingWorkAllowed: pendingLive ? pending!.allowed : null,
    pendingLine: pendingLive
      ? `${s.name}: ${pending!.text}`
      : `${s.name}: ${NATIONAL_PENDING}`,
    applicationProhibitsPending: prohibitsLive ? prohibits!.prohibits : null,
    prohibitsLine: prohibitsLive
      ? `${s.name}: ${prohibits!.text}`
      : `${s.name}: ${NATIONAL_PENDING}`,
    combinedScheme: combinedLive ? combined!.scheme : null,
    combinedLine: combinedLive
      ? combined!.text
      : `${s.name}: the children's check and the NDIS clearance may be one registration or two; ${CHECK_YOUR_UNIT}.`,
    childrenTermYears:
      childrenLive && typeof s.childrenCheck.termYears === "number"
        ? s.childrenCheck.termYears
        : null,
    sources,
  };
}

export type Part4Facts =
  | {
      live: true;
      section: string;
      endedOn: string;
      readAt: string;
      line: string;
    }
  | { live: false; line: string };

/**
 * The national block's Part 4 line for one state served (D-2426 as amended;
 * findings 187 and 208): the section and the day its arrangement ended, with
 * the day the Rules were read, or the fallback when the block's read is stale.
 */
export function part4FactsFor(code: string, today: string): Part4Facts {
  const block = STATE_FILE.national.acceptableChecks;
  const line = block?.byState[code];
  if (!block || !line || !isLive(block, today))
    return { live: false, line: CHECK_PART_4 };
  const ended = formatLongDay(line.endedOn);
  return {
    live: true,
    section: line.section,
    endedOn: line.endedOn,
    readAt: block.source.readAt,
    line: `no acceptable state check applies after ${ended} (Rules s ${line.section}, as the Rules read on ${formatLongDay(block.source.readAt)}); every Part 4 arrangement has ended by its own date, s 29B at the end of 1 February 2024 (s 29B(10))`,
  };
}

/** The per-state latest day for the (1)(b) help text (finding 238), or null where the file holds none. */
export function part4EndFor(code: string): string | null {
  return STATE_FILE.part4Ends?.byState[code] ?? null;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "31 January 2026" from an ISO day; the input is left as it is when it is not one. */
export function formatLongDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}
