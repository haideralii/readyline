/**
 * REQ-024 Session A3 (FR-6, FR-6a): the worker file, the workers index and
 * the two Worker Screening Rules lists as rows, built from a snapshot the
 * server reads once. Pure: the same snapshot gives the same rows for the
 * owner's pack, the auditor link's pack and the account export, and a unit
 * test holds every rule. No row ever carries a name, a date of birth or an
 * address: the fill (FR-6b) adds those columns to a direct download only
 * (SR-8(a)), and where a cell would hold one the bracket text stands.
 */
import type {
  OnboardingChecklistRow,
  OnboardingItemRow,
  RegisterEventRow,
  RiskAssessedRoleRow,
  ScreeningExceptionRow,
  StaffMatrixRow,
  SupervisionEntryRow,
} from "./audit-day-types";
import {
  WORKER_ROLE_LABELS,
  type WorkerOnboardingItem,
} from "./onboarding-items";
import { CSV_COLUMNS, toCsv, toCsvWithFirstLine } from "./csv";
import { sortEntries } from "./supervision";
import type { WorkerClearanceRow } from "./types";
import type { WorkerState } from "./worker-state";

/** FR-6b: the bracket text a cell carries when the owner has not filled it (a CSV has no highlight). */
export const FILL_BRACKETS = {
  full_name: "[Full name]",
  date_of_birth: "[Date of birth]",
  address: "[Address]",
  assessor_name: "[Assessor name and title]",
  supervisor_name: "[Supervisor name]",
} as const;
export type FillColumn = keyof typeof FILL_BRACKETS;

/** The fill columns a filled screening list and a filled roles list carry, after the number columns. */
export const SCREENING_FILL_COLUMNS = [
  "full_name",
  "date_of_birth",
  "address",
  "supervisor_name",
] as const;
export const ROLES_FILL_COLUMNS = ["assessor_name"] as const;

export type WorkerFill = {
  /** By worker code. */
  workers: Record<
    string,
    { full_name?: string; date_of_birth?: string; address?: string }
  >;
  /** By the supervising worker's code (s 18(3)(c)(iii)). */
  supervisors: Record<string, string>;
  /** s 17: the assessor's name and title; the owner's own name is pre-filled on the screen, never stored here. */
  assessor_name?: string;
};

/** The roles s 5 treats as risk assessed by default when the trail's `role-changed` notes are read (s 20). */
export const DEFAULT_RISK_ROLE_CODES: readonly string[] = [
  "support-worker",
  "team-leader",
  "key-personnel",
];

export type WorkerExportSnapshot = {
  /** The day the lists speak as at (FR-6a: today until REQ-023 Session B's period selector). */
  asAt: string;
  rows: readonly StaffMatrixRow[];
  checklists: readonly OnboardingChecklistRow[];
  items: readonly OnboardingItemRow[];
  clearances: readonly WorkerClearanceRow[];
  roles: readonly RiskAssessedRoleRow[];
  exceptions: readonly ScreeningExceptionRow[];
  /** REQ-024 Session C (FR-11): the supervision history, filtered by the pack's period where one is chosen (D-2832). */
  entries: readonly SupervisionEntryRow[];
  events: readonly RegisterEventRow[];
  /** The derived state per worker code (`listWorkerStates`). */
  states: ReadonlyMap<string, WorkerState>;
  /** The derived items per worker code (`workerOnboardingItems` over `contextFor`). */
  itemsByRef: ReadonlyMap<string, readonly WorkerOnboardingItem[]>;
};

/** FR-6a's first line (findings 48, 51 and 85): a draft of what the Rules ask for, never "the list". */
export function rulesListFirstLine(kind: "s17" | "s18", asAt: string): string {
  const section = kind === "s17" ? "s 17" : "s 18";
  const note =
    kind === "s17"
      ? " The roles are those s 17(1) names: key personnel roles and roles whose normal duties include the direct delivery of specified supports or more than incidental contact with a person with disability (W-1c)."
      : "";
  return `This is a draft of the information the Worker Screening Rules ask you to keep (${section}), as at ${asAt}. Once you complete it, keep every dated copy with your HR file, or keep this with your dated trail (s 18(2) and s 20), and check it against the Rules yourself. The unit's letters (s 18(4)), misconduct records (s 18(5)) and personnel contracts (s 19) are your paper file beside this list. Readyline does not keep a copy.${note}`;
}

/** The line that follows when cells are brackets (FR-6b): the owner completes them and keeps the file seven years. */
export function fillFirstLine(kind: "s17" | "s18"): string {
  const section = kind === "s17" ? "s 17" : "s 18";
  return `The bracketed cells are for you to complete (${section}); keep the completed file with your HR records for seven years (s 21). Readyline does not keep a copy.`;
}

const ROLE_CHANGE =
  /^from=([a-z-]+) to=([a-z-]+) on=([0-9]{4}-[0-9]{2}-[0-9]{2})$/;

/** A `role-changed` note in the fixed form `from=<code> to=<code> on=<date>` (findings 58 and 107). */
export function parseRoleChange(
  note: string,
): { from: string; to: string; on: string } | null {
  const m = ROLE_CHANGE.exec(note.trim());
  return m ? { from: m[1], to: m[2], on: m[3] } : null;
}

export type RiskSegment = { start: string; end: string | null };

type RiskRow = Pick<
  StaffMatrixRow,
  "risk_assessed" | "risk_assessed_from" | "started_on" | "ended_on"
>;
type TrailEvent = Pick<RegisterEventRow, "kind" | "note" | "at">;

/**
 * s 20 (AC-13): the days a worker was in a risk assessed role, from the row
 * and its trail. A `role-changed` note into a risk role opens a segment on
 * its day and one out of a risk role closes it; the row's own
 * `risk_assessed_from` opens the current segment when the trail has not,
 * and `ended_on` closes whatever is open.
 */
export function riskSegments(
  row: RiskRow,
  events: readonly TrailEvent[],
  riskCodes: readonly string[] = DEFAULT_RISK_ROLE_CODES,
): RiskSegment[] {
  const changes = events
    .filter((e) => e.kind === "role-changed")
    .map((e) => parseRoleChange(e.note))
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => a.on.localeCompare(b.on));
  const out: RiskSegment[] = [];
  let open: RiskSegment | null = null;
  for (const c of changes) {
    const toRisk = riskCodes.includes(c.to);
    if (toRisk && !open) open = { start: c.on, end: null };
    else if (!toRisk && open) {
      open.end = c.on;
      out.push(open);
      open = null;
    }
  }
  if (row.risk_assessed && !open) {
    const start = row.risk_assessed_from ?? row.started_on;
    if (start) open = { start, end: null };
  }
  if (open) {
    if (row.ended_on) open.end = row.ended_on;
    out.push(open);
  }
  return out;
}

/** Whether the worker is on the s 18 list as at the day. */
export function onScreeningList(
  row: RiskRow,
  events: readonly TrailEvent[],
  asAt: string,
  riskCodes: readonly string[] = DEFAULT_RISK_ROLE_CODES,
): boolean {
  return riskSegments(row, events, riskCodes).some(
    (s) => s.start <= asAt && (s.end === null || asAt <= s.end),
  );
}

/** FR-6a (finding 120): "clearance" from a numbered row with an issue date, "excluded" from the decision code, blank while pending. */
export function clearanceOutcome(
  c: Pick<
    WorkerClearanceRow,
    "clearance_number" | "issued_on" | "decision_code"
  > | null,
): "clearance" | "excluded" | "" {
  if (!c) return "";
  if (c.decision_code === "excluded") return "excluded";
  if (c.clearance_number && c.issued_on) return "clearance";
  return "";
}

/** The exception column (D-2439, D-2434): a Part 4 row prints its section and state; the five codes stand as they are. */
export function exceptionPart4(
  e: Pick<ScreeningExceptionRow, "code" | "part4_state">,
  sectionFor: (state: string) => string | null,
): string {
  if (!e.part4_state) return "";
  const n = sectionFor(e.part4_state);
  return n
    ? `s 14(1)(b), Part 4 s ${n} (${e.part4_state})`
    : `s 14(1)(b), Part 4 (${e.part4_state})`;
}

function screeningRow(
  clearances: readonly WorkerClearanceRow[],
  ref: string,
): WorkerClearanceRow | null {
  const rows = clearances
    .filter(
      (c) =>
        c.worker_ref === ref && c.clearance_kind === "ndis-worker-screening",
    )
    .sort((a, b) =>
      (b.issued_on ?? b.created_at).localeCompare(a.issued_on ?? a.created_at),
    );
  return rows[0] ?? null;
}

/** The exception that applied as at the day, else the latest one. */
function exceptionFor(
  exceptions: readonly ScreeningExceptionRow[],
  ref: string,
  asAt: string,
): ScreeningExceptionRow | null {
  const mine = exceptions
    .filter((e) => e.worker_ref === ref)
    .sort((a, b) => b.started_on.localeCompare(a.started_on));
  return (
    mine.find(
      (e) =>
        e.started_on <= asAt && (e.ended_on === null || asAt <= e.ended_on),
    ) ??
    mine[0] ??
    null
  );
}

const roleLabel = (row: Pick<StaffMatrixRow, "role" | "role_label">) =>
  (row.role &&
    WORKER_ROLE_LABELS[row.role as keyof typeof WORKER_ROLE_LABELS]) ||
  row.role_label;

const eventsForRow = (
  s: WorkerExportSnapshot,
  register: string,
  rowId: string,
) => s.events.filter((e) => e.register === register && e.row_id === rowId);

/** FR-6a, s 18: every current and past risk assessed worker as at the day, by code; a fill adds its columns. */
export function screeningListRows(
  s: WorkerExportSnapshot,
  options: {
    fill?: WorkerFill;
    sectionFor?: (state: string) => string | null;
    riskCodes?: readonly string[];
  } = {},
): Record<string, unknown>[] {
  const sectionFor = options.sectionFor ?? (() => null);
  const out: Record<string, unknown>[] = [];
  for (const row of [...s.rows].sort((a, b) =>
    a.worker_ref.localeCompare(b.worker_ref),
  )) {
    const trail = eventsForRow(s, "staff_matrix", row.id);
    if (!onScreeningList(row, trail, s.asAt, options.riskCodes)) continue;
    const c = screeningRow(s.clearances, row.worker_ref);
    const e = exceptionFor(s.exceptions, row.worker_ref, s.asAt);
    const r: Record<string, unknown> = {
      worker_ref: row.worker_ref,
      role: row.role ?? "",
      role_label: roleLabel(row),
      risk_assessed_from: row.risk_assessed_from ?? row.started_on ?? "",
      ended_on: row.ended_on ?? "",
      application_number: c?.application_number ?? "",
      clearance_number: c?.clearance_number ?? "",
      outcome: clearanceOutcome(c),
      issued_on: c?.issued_on ?? "",
      expires_on: c?.expires_on ?? "",
      verified_in_database_on: c?.verified_in_database_on ?? "",
      decision_code: c?.decision_code ?? "",
      decision_on: c?.decision_on ?? "",
      exception_code: e?.code ?? "",
      exception_started_on: e?.started_on ?? "",
      exception_ended_on: e?.ended_on ?? "",
      exception_end_code: e?.end_code ?? "",
      exception_supervisor_ref: e?.supervisor_ref ?? "",
      exception_part4: e ? exceptionPart4(e, sectionFor) : "",
    };
    if (options.fill) {
      const w = options.fill.workers[row.worker_ref] ?? {};
      r.full_name = w.full_name?.trim() || FILL_BRACKETS.full_name;
      r.date_of_birth = w.date_of_birth?.trim() || FILL_BRACKETS.date_of_birth;
      r.address = w.address?.trim() || FILL_BRACKETS.address;
      r.supervisor_name = e?.supervisor_ref
        ? options.fill.supervisors[e.supervisor_ref]?.trim() ||
          FILL_BRACKETS.supervisor_name
        : "";
    }
    out.push(r);
  }
  return out;
}

/** FR-6a, s 17: the roles a current row holds or that carry an assessment; a seeded role nobody holds stays off (finding 80). */
export function riskAssessedRolesRows(
  s: WorkerExportSnapshot,
  options: { fill?: WorkerFill } = {},
): Record<string, unknown>[] {
  const held = new Set(
    s.rows.filter((r) => !r.ended_on && r.role_ref).map((r) => r.role_ref),
  );
  return s.roles
    .filter((r) => held.has(r.id) || r.assessed_on !== null)
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((r) => {
      const row: Record<string, unknown> = {
        title: r.title,
        paragraphs: r.paragraphs.join(" "),
        description: r.description,
        assessed_on: r.assessed_on ?? "",
        assessor_ref: r.assessor_ref ?? "",
        first_held_on: r.first_held_on ?? "",
        seed_code: r.seed_code ?? "",
      };
      if (options.fill)
        row.assessor_name =
          options.fill.assessor_name?.trim() || FILL_BRACKETS.assessor_name;
      return row;
    });
}

export const workerFileName = (ref: string) => `workers/${ref}.csv`;

/** FR-6: the index, current workers first and past workers (an `ended_on`) after them, each with its file. */
export function workersIndexRows(
  s: WorkerExportSnapshot,
): Record<string, unknown>[] {
  const rows = [...s.rows].sort((a, b) => {
    const pa = a.ended_on ? 1 : 0;
    const pb = b.ended_on ? 1 : 0;
    return pa - pb || a.worker_ref.localeCompare(b.worker_ref);
  });
  return rows.map((r) => {
    const state = s.states.get(r.worker_ref);
    return {
      section: r.ended_on ? "past" : "current",
      worker_ref: r.worker_ref,
      role: r.role ?? "",
      role_label: roleLabel(r),
      states: r.states.join(" "),
      risk_assessed: r.risk_assessed,
      started_on: r.started_on ?? "",
      ended_on: r.ended_on ?? "",
      state: state?.label ?? "",
      outstanding: state?.outstanding.length ?? 0,
      file: workerFileName(r.worker_ref),
    };
  });
}

const blank = (): Record<string, unknown> => ({
  kind: "",
  item_id: "",
  text: "",
  who: "",
  state: "",
  done_on: "",
  confirmed_on: "",
  recorded_by_owner: "",
  clearance_kind: "",
  application_number: "",
  clearance_number: "",
  issued_on: "",
  expires_on: "",
  verified_in_database_on: "",
  decision_code: "",
  decision_on: "",
  at: "",
  event: "",
  note: "",
});

export type ItemStateWord =
  "outstanding" | "done" | "done, waiting for confirmation" | "confirmed";

/** The state word for an item from its row (FR-8's two-party items wait for the owner's confirmation). */
export function itemState(
  item: Pick<WorkerOnboardingItem, "who">,
  row: Pick<OnboardingItemRow, "done_on" | "confirmed_on"> | null,
): ItemStateWord {
  if (!row || (!row.done_on && !row.confirmed_on)) return "outstanding";
  if (row.confirmed_on) return "confirmed";
  return item.who === "both" ? "done, waiting for confirmation" : "done";
}

/**
 * FR-6: one worker's file as rows of one table: the derived items with their
 * state and dates, the clearance rows with their numbers, the exceptions,
 * the supervision entries (FR-11, AC-9: the kind in `item_id`, the day in
 * `done_on`, the supervisor's code in `who`, a review's outcome in `state`)
 * and the trail (the staff row's, the clearances', the items', the
 * exceptions' and the entries' events), oldest first.
 */
export function workerFileRows(
  s: WorkerExportSnapshot,
  ref: string,
): Record<string, unknown>[] {
  const row = s.rows.find((r) => r.worker_ref === ref);
  if (!row) return [];
  const list = s.checklists.find(
    (c) => c.kind === "worker" && c.subject_ref === ref,
  );
  const states = list ? s.items.filter((i) => i.checklist_id === list.id) : [];
  const out: Record<string, unknown>[] = [];
  for (const item of s.itemsByRef.get(ref) ?? []) {
    const st = states.find((x) => x.item_id === item.id) ?? null;
    out.push({
      ...blank(),
      kind: "item",
      item_id: item.id,
      text: item.text,
      who: item.who,
      state: itemState(item, st),
      done_on: st?.done_on ?? "",
      confirmed_on: st?.confirmed_on ?? "",
      recorded_by_owner: st ? st.recorded_by_owner : "",
    });
  }
  const mine = s.clearances.filter((c) => c.worker_ref === ref);
  for (const c of [...mine].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  ))
    out.push({
      ...blank(),
      kind: "clearance",
      clearance_kind: c.clearance_kind,
      application_number: c.application_number,
      clearance_number: c.clearance_number,
      issued_on: c.issued_on ?? "",
      expires_on: c.expires_on ?? "",
      verified_in_database_on: c.verified_in_database_on ?? "",
      decision_code: c.decision_code ?? "",
      decision_on: c.decision_on ?? "",
      state: clearanceOutcome(c) || (c.issued_on ? "" : "pending"),
    });
  const exceptions = s.exceptions.filter((e) => e.worker_ref === ref);
  for (const e of [...exceptions].sort((a, b) =>
    a.started_on.localeCompare(b.started_on),
  ))
    out.push({
      ...blank(),
      kind: "exception",
      item_id: e.code,
      state: e.ended_on ? `ended: ${e.end_code ?? ""}` : "running",
      done_on: e.started_on,
      confirmed_on: e.ended_on ?? "",
      note: e.supervisor_ref ? `supervisor ${e.supervisor_ref}` : "",
    });
  const entries = s.entries.filter((e) => e.worker_ref === ref);
  for (const e of sortEntries(entries).reverse())
    out.push({
      ...blank(),
      kind: "supervision",
      item_id: e.kind,
      who: e.by_ref,
      state: e.outcome ?? "",
      done_on: e.held_on,
      note: e.note,
    });
  const ids = new Set<string>([
    row.id,
    ...states.map((x) => x.id),
    ...mine.map((c) => c.id),
    ...exceptions.map((e) => e.id),
    ...entries.map((e) => e.id),
  ]);
  for (const e of s.events
    .filter((e) => ids.has(e.row_id))
    .sort((a, b) => a.at.localeCompare(b.at)))
    out.push({
      ...blank(),
      kind: "event",
      at: e.at,
      event: `${e.register}: ${e.kind}`,
      note: e.note,
    });
  return out;
}

/**
 * FR-6, FR-6a, AC-5: the files the owner's pack and the auditor link's pack
 * both carry, by name: the workers index, one file per worker, and the two
 * Rules lists unfilled, their first line the draft notice. No file here ever
 * holds a fill column (SR-8(a)); the fill is a direct download of its own.
 */
export function packWorkerFiles(
  s: WorkerExportSnapshot,
  stamp: string,
  sectionFor?: (state: string) => string | null,
): Record<string, string> {
  const files: Record<string, string> = {};
  files["workers/index.csv"] = toCsv(
    CSV_COLUMNS.workers_index,
    workersIndexRows(s),
  );
  for (const r of s.rows)
    files[workerFileName(r.worker_ref)] = toCsv(
      CSV_COLUMNS.worker_file,
      workerFileRows(s, r.worker_ref),
    );
  files[`screening-list-${stamp}.csv`] = toCsvWithFirstLine(
    rulesListFirstLine("s18", s.asAt),
    CSV_COLUMNS.screening_list,
    screeningListRows(s, { sectionFor }),
  );
  files[`risk-assessed-roles-${stamp}.csv`] = toCsvWithFirstLine(
    rulesListFirstLine("s17", s.asAt),
    CSV_COLUMNS.risk_assessed_roles,
    riskAssessedRolesRows(s),
  );
  return files;
}
