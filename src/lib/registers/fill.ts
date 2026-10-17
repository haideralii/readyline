/**
 * REQ-024 Session A3, the one-time fill (FR-6b; D-2408, D-2409, D-2447;
 * SR-7, SR-8): the words on the export screen and the printable notice, the
 * shape of what the owner types, and the files a filled or unfilled
 * submission produces. Pure: the handler parses the form with `parseFill`,
 * builds the file with `buildFillFile`, sends it and keeps nothing. Every
 * value the owner types stays inside the request (SR-7); this module never
 * logs and never stores.
 */
import { strToU8, zipSync } from "fflate";
import { z } from "zod";
import { CSV_BOM, CSV_COLUMNS, toCsv, toCsvWithFirstLine } from "./csv";
import {
  FILL_BRACKETS,
  ROLES_FILL_COLUMNS,
  SCREENING_FILL_COLUMNS,
  fillFirstLine,
  riskAssessedRolesRows,
  rulesListFirstLine,
  screeningListRows,
  workerFileName,
  workerFileRows,
  workersIndexRows,
  type WorkerExportSnapshot,
  type WorkerFill,
} from "./worker-exports";

/** The three files the export screen builds, each behind its own path (FR-6b). */
export const FILL_KINDS = [
  "screening-list",
  "risk-assessed-roles",
  "workers",
] as const;
export type FillKind = (typeof FILL_KINDS)[number];

export const FILL_PATHS: Record<FillKind, string> = {
  "screening-list": "/registers/staff/export/screening-list",
  "risk-assessed-roles": "/registers/staff/export/risk-assessed-roles",
  workers: "/registers/staff/export/workers",
};
/** The export screen, the only page a fill may be posted from (SR-8(a)). */
export const EXPORT_SCREEN_PATH = "/registers/staff-matrix/export";
export const NOTICE_PATH = "/registers/staff-matrix/export/notice";

/** The handler's own home: Sydney in code, read by the switchboard and a unit test (SR-8(e); finding 33). */
export const FILL_PREFERRED_REGION = "syd1";

/** Ten minutes after the last keystroke the fields are cleared (SR-8(b)). */
export const FILL_CLEAR_MS = 10 * 60 * 1000;

export const FILL_LIMITS = { name: 120, address: 200 } as const;

/** The words, fixed (FR-6b; findings 31, 39, 86, 92, 124, 134, 161). */
export const FILL_COPY = {
  checkbox:
    "Fill in names, dates of birth and addresses now. Readyline uses them for this file only and does not keep them.",
  ownerNotice:
    "Tell your workers this is where their details go; our privacy policy says so, and the printed notice below is for workers who never sign in.",
  app36b:
    "We take these details from you rather than from each worker because asking every worker for one file is impracticable.",
  tick: "I have told, or will tell as soon as practicable, each of these workers that Readyline uses their details for this file only",
  workersOnly: "Workers only. Never a participant's details.",
  tickRequired:
    "Tick the line about telling your workers before you download a filled file.",
  refused:
    "You have built several filled files in the last hour. Your typed values are still on this page; try again in a little while.",
  /** The printable notice's one paragraph: fixed text, no code and no typed value (finding 124). */
  notice: (policyUrl: string, policyUpdated: string) =>
    `The provider you work for keeps your name, date of birth and address in its own records. When the provider builds the worker list the NDIS Worker Screening Rules ask it to keep, Readyline receives those details once to build that file and does not keep them; the file names the provider you work for, and an auditor may be shown your worker code and your check number. Readyline's privacy policy says so at ${policyUrl} (the version dated ${policyUpdated}). Questions go to the provider you work for first; Readyline's contact is on that page.`,
} as const;

const ISO_DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
/** The batch 45 CHECK in TypeScript: nine digits starting 43 is an NDIS number, never a worker field. */
const NDIS_NUMBER = /\b43[0-9]{7}\b/;
const WORKER_REF = /^(W|KP)-?[0-9]{1,6}$/;

const Text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((s) => !NDIS_NUMBER.test(s), "looks like an NDIS number");

export const FillField = {
  name: Text(FILL_LIMITS.name),
  address: Text(FILL_LIMITS.address),
  dob: z
    .string()
    .trim()
    .refine(
      (s) => s === "" || (ISO_DATE.test(s) && !Number.isNaN(Date.parse(s))),
      "a date as YYYY-MM-DD",
    ),
} as const;

export type FillSubmission = {
  kind: FillKind;
  /** The checkbox: without it the file carries bracket text and no value is read. */
  fill: boolean;
  asAt: string | null;
  values: WorkerFill;
};

export type FillParse =
  { ok: true; submission: FillSubmission } | { ok: false; message: string };

/**
 * Reads the posted form. Field names: `fill` (the checkbox), `told` (the
 * required tick), `as_at`, `name:<code>`, `dob:<code>`, `address:<code>`,
 * `supervisor:<code>`, `assessor_name`. Unknown fields are refused, as at
 * every boundary (REQ-002 FR-3); a refused submission names the first
 * problem in plain words and the handler returns the form with its values.
 */
export function parseFill(
  kind: FillKind,
  entries: Iterable<[string, FormDataEntryValue]>,
): FillParse {
  const values: WorkerFill = { workers: {}, supervisors: {} };
  let fill = false;
  let told = false;
  let asAt: string | null = null;
  const problem = (field: string, issue: string) => ({
    ok: false as const,
    message: `${field}: ${issue}.`,
  });
  for (const [rawKey, raw] of entries) {
    if (typeof raw !== "string")
      return problem(rawKey, "a file is not a value");
    const key = rawKey.trim();
    if (key === "fill") {
      fill = raw === "on" || raw === "1";
      continue;
    }
    if (key === "told") {
      told = raw === "on" || raw === "1";
      continue;
    }
    if (key === "as_at") {
      if (raw.trim() === "") continue;
      const d = FillField.dob.safeParse(raw);
      if (!d.success) return problem("as at", "a date as YYYY-MM-DD");
      asAt = d.data;
      continue;
    }
    if (key === "assessor_name") {
      const v = FillField.name.safeParse(raw);
      if (!v.success)
        return problem(
          "assessor name",
          v.error.issues[0]?.message ?? "refused",
        );
      if (v.data) values.assessor_name = v.data;
      continue;
    }
    const m = /^(name|dob|address|supervisor):(.+)$/.exec(key);
    if (!m) return problem(key, "not a field on this screen");
    const [, field, ref] = m;
    if (!WORKER_REF.test(ref)) return problem(key, "not a worker code");
    if (field === "supervisor") {
      const v = FillField.name.safeParse(raw);
      if (!v.success)
        return problem(key, v.error.issues[0]?.message ?? "refused");
      if (v.data) values.supervisors[ref] = v.data;
      continue;
    }
    const schema =
      field === "name"
        ? FillField.name
        : field === "dob"
          ? FillField.dob
          : FillField.address;
    const v = schema.safeParse(raw);
    if (!v.success)
      return problem(key, v.error.issues[0]?.message ?? "refused");
    if (!v.data) continue;
    const w = (values.workers[ref] ??= {});
    if (field === "name") w.full_name = v.data;
    else if (field === "dob") w.date_of_birth = v.data;
    else w.address = v.data;
  }
  if (fill && !told) return { ok: false, message: FILL_COPY.tickRequired };
  if (!fill) {
    // Unticked: nothing typed is read (FR-6b), the file carries bracket text.
    return {
      ok: true,
      submission: {
        kind,
        fill: false,
        asAt,
        values: { workers: {}, supervisors: {} },
      },
    };
  }
  return { ok: true, submission: { kind, fill: true, asAt, values } };
}

export type FillFile = {
  fileName: string;
  contentType: "text/csv; charset=utf-8" | "application/zip";
  body: Uint8Array;
  /** Rows (or worker files) the audit line counts; never a value (SR-7). */
  count: number;
};

/** The worker file's fill columns, carried on one `worker` row at the top of a filled file. */
export const WORKER_FILE_FILL_COLUMNS = [
  "full_name",
  "date_of_birth",
  "address",
] as const;

function stampOf(asAt: string): string {
  return asAt;
}

/**
 * Builds the file for one submission. Unticked or with a cell left empty,
 * the fill columns read the bracket text and the first line says the owner
 * completes them (SR-8(c)); filled, the values are in the file and nowhere
 * else. The screening list and the roles list are one CSV each; the worker
 * files are one zip of the `workers/` folder (finding 77).
 */
export function buildFillFile(
  snapshot: WorkerExportSnapshot,
  submission: FillSubmission,
  sectionFor?: (state: string) => string | null,
): FillFile {
  const s = submission.asAt ? { ...snapshot, asAt: submission.asAt } : snapshot;
  const stamp = stampOf(s.asAt);
  const fill = submission.values;
  if (submission.kind === "screening-list") {
    const rows = screeningListRows(s, { fill, sectionFor });
    const columns = [...CSV_COLUMNS.screening_list, ...SCREENING_FILL_COLUMNS];
    const brackets = rows.some((r) =>
      SCREENING_FILL_COLUMNS.some((c) => String(r[c] ?? "").startsWith("[")),
    );
    const first = brackets
      ? `${rulesListFirstLine("s18", s.asAt)} ${fillFirstLine("s18")}`
      : rulesListFirstLine("s18", s.asAt);
    return {
      fileName: `screening-list-${stamp}.csv`,
      contentType: "text/csv; charset=utf-8",
      body: strToU8(toCsvWithFirstLine(first, columns, rows)),
      count: rows.length,
    };
  }
  if (submission.kind === "risk-assessed-roles") {
    const rows = riskAssessedRolesRows(s, { fill });
    const columns = [...CSV_COLUMNS.risk_assessed_roles, ...ROLES_FILL_COLUMNS];
    const brackets = rows.some(
      (r) => r.assessor_name === FILL_BRACKETS.assessor_name,
    );
    const first = brackets
      ? `${rulesListFirstLine("s17", s.asAt)} ${fillFirstLine("s17")}`
      : rulesListFirstLine("s17", s.asAt);
    return {
      fileName: `risk-assessed-roles-${stamp}.csv`,
      contentType: "text/csv; charset=utf-8",
      body: strToU8(toCsvWithFirstLine(first, columns, rows)),
      count: rows.length,
    };
  }
  const files: Record<string, Uint8Array> = {
    "workers/index.csv": strToU8(
      toCsv(CSV_COLUMNS.workers_index, workersIndexRows(s)),
    ),
  };
  const columns = [...CSV_COLUMNS.worker_file, ...WORKER_FILE_FILL_COLUMNS];
  for (const r of s.rows) {
    const w = fill.workers[r.worker_ref] ?? {};
    const head: Record<string, unknown> = Object.fromEntries(
      columns.map((c) => [c, ""]),
    );
    head.kind = "worker";
    head.item_id = r.worker_ref;
    head.full_name = w.full_name?.trim() || FILL_BRACKETS.full_name;
    head.date_of_birth = w.date_of_birth?.trim() || FILL_BRACKETS.date_of_birth;
    head.address = w.address?.trim() || FILL_BRACKETS.address;
    const rows = [
      head,
      ...workerFileRows(s, r.worker_ref).map((row) => ({
        ...row,
        full_name: "",
        date_of_birth: "",
        address: "",
      })),
    ];
    const first = `${rulesListFirstLine("s18", s.asAt)} ${fillFirstLine("s18")}`;
    files[workerFileName(r.worker_ref)] = strToU8(
      toCsvWithFirstLine(first, columns, rows),
    );
  }
  return {
    fileName: `workers-${stamp}.zip`,
    contentType: "application/zip",
    body: zipSync(files, { level: 6 }),
    count: s.rows.length,
  };
}

/** The bytes of a CSV without its byte-order mark, for a test or a reader. */
export function stripBom(text: string): string {
  return text.startsWith(CSV_BOM) ? text.slice(CSV_BOM.length) : text;
}
