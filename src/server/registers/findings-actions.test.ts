// @vitest-environment node
/**
 * REQ-033 AC-2, SR-1, SR-2 (D-2930, D-2931): the parse action reads an
 * uploaded report in the request and keeps nothing (no storage call, a log
 * line with counts and never the words); the save action refuses a row the
 * participant gate flags with the detector's own message, saves the rest
 * with an improvement row each, and writes the trail and the audit lines.
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const logged: Record<string, unknown>[] = [];
const inserted: { table: string; row: Record<string, unknown> }[] = [];
let viewer: {
  account: { id: string } | null;
  deleted: null;
  user: { id: string };
} | null = {
  account: { id: "acc-1" },
  deleted: null,
  user: { id: "user-1" },
};
let storageTouched = false;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/logging/logger", () => ({
  log: {
    info: (event: string, fields: Record<string, unknown>) =>
      logged.push({ event, ...fields }),
    warn: (event: string, fields: Record<string, unknown>) =>
      logged.push({ event, ...fields }),
  },
}));
vi.mock("@/server/accounts/queries", () => ({ getViewer: async () => viewer }));
vi.mock("@/server/auth/rate-limit", () => ({
  checkRegisterWriteAllowed: async () => true,
}));
vi.mock("@/server/registers/worker-onboarding", () => ({
  todaySydney: () => "2026-10-18",
}));
vi.mock("@/server/supabase/server", () => ({
  createSupabaseServerClient: async () => fakeSupabase(),
}));

let seq = 0;
function fakeSupabase() {
  const chain = (table: string) => {
    let pending: Record<string, unknown> | null = null;
    const api = {
      insert(row: Record<string, unknown>) {
        pending = row;
        inserted.push({ table, row });
        return api;
      },
      update(row: Record<string, unknown>) {
        inserted.push({ table: `${table}:update`, row });
        return api;
      },
      eq() {
        return api;
      },
      select() {
        return api;
      },
      async single() {
        seq += 1;
        return {
          data: {
            id: `${table}-${seq}`,
            reference: `FND-${String(seq).padStart(4, "0")}`,
            ...(pending ?? {}),
          },
          error: null,
        };
      },
      then(resolve: (v: unknown) => void) {
        resolve({ data: null, error: null });
      },
    };
    return api;
  };
  return {
    from: (table: string) => chain(table),
    get storage() {
      storageTouched = true;
      throw new Error("storage must never be touched (D-2930)");
    },
  };
}

const { parseFindingsAction, saveFindingsAction } =
  await import("./findings-actions");

beforeEach(() => {
  logged.length = 0;
  inserted.length = 0;
  storageTouched = false;
  seq = 0;
  viewer = { account: { id: "acc-1" }, deleted: null, user: { id: "user-1" } };
});

const report = readFileSync("fixtures/findings/sample-report.txt", "utf8");

describe("parseFindingsAction (FR-1, D-2930)", () => {
  it("reads a pasted report into three candidates and logs the count alone", async () => {
    const r = await parseFindingsAction({ text: report });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.candidates).toHaveLength(3);
    expect(r.source).toBe("paste");
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({
      event: "findings.paste.read",
      candidates: 3,
    });
    expect(JSON.stringify(logged)).not.toMatch(
      /Smith|incident register|non-conformity/i,
    );
    expect(storageTouched).toBe(false);
  });

  it("AC-2: reads an uploaded PDF and an uploaded Word file into the same three candidates, touches no storage, logs counts and never words", async () => {
    for (const [name, type] of [
      ["sample-report.pdf", "application/pdf"],
      [
        "sample-report.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
    ] as const) {
      logged.length = 0;
      const fd = new FormData();
      fd.append(
        "file",
        new File(
          [new Uint8Array(readFileSync(`fixtures/findings/${name}`))],
          name,
          { type },
        ),
      );
      const r = await parseFindingsAction(fd);
      expect(r.ok, name).toBe(true);
      if (!r.ok) return;
      expect(r.candidates.map((c) => c.text)).toEqual(
        (await parseFindingsAction({ text: report })).ok
          ? (
              (await parseFindingsAction({ text: report })) as {
                candidates: { text: string }[];
              }
            ).candidates.map((c) => c.text)
          : [],
      );
      const line = logged.find((l) => l.event === "findings.report.read")!;
      expect(line).toMatchObject({
        candidates: 3,
        kind: name.endsWith(".pdf") ? "pdf" : "docx",
      });
      expect(JSON.stringify(logged)).not.toMatch(
        /Smith|incident register|non-conformity/i,
      );
      expect(storageTouched).toBe(false);
    }
  });

  it("refuses a file that is not a report, with the plain message, and asks a signed-out caller to sign in", async () => {
    const fd = new FormData();
    fd.append("file", new File(["hello"], "notes.txt", { type: "text/plain" }));
    const r = await parseFindingsAction(fd);
    expect(r).toEqual({
      ok: false,
      message:
        "That file is not a PDF or a Word document. Export the report as one of those, or paste the findings.",
    });
    viewer = null;
    expect(await parseFindingsAction({ text: report })).toEqual({
      ok: false,
      message: "Sign in to use the registers.",
    });
  });
});

describe("saveFindingsAction (FR-2, FR-5, SR-2, SR-3)", () => {
  it("saves the rows that pass, each with its improvement row, trail and audit line, and refuses the flagged one with the detector's message", async () => {
    const r = await saveFindingsAction({
      rows: [
        {
          standard_id: "core.governance.incident-management",
          indicator: "",
          severity: "minor",
          finding:
            "The incident register had no record of the Commission being told.",
          due_on: "2026-11-30",
        },
        {
          standard_id: "",
          indicator: "",
          severity: "observation",
          finding: "A support note for Mr J. Smith named him in full.",
          due_on: "",
        },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.saved).toBe(1);
    expect(r.references).toEqual(["FND-0001"]);
    expect(r.refused).toEqual([
      {
        index: 1,
        message:
          "This looks like it contains a person's name. Use a reference code such as P-014 instead of naming a participant.",
      },
    ]);
    const tables = inserted.map((i) => i.table);
    expect(tables).toEqual([
      "findings",
      "improvements",
      "findings:update",
      "register_events",
      "register_events",
      "audit_log",
    ]);
    const improvement = inserted.find((i) => i.table === "improvements")!.row;
    expect(improvement).toMatchObject({
      account_id: "acc-1",
      source_kind: "audit-finding",
      source_ref: "FND-0001",
      due_on: "2026-11-30",
      owner_role: "Owner",
    });
    expect(String(improvement.learned)).toContain("incident register");
    expect(inserted.find((i) => i.table === "audit_log")!.row).toMatchObject({
      action: "register.findings.created",
      actor_user_id: "user-1",
    });
    // The refused words reached no table.
    expect(JSON.stringify(inserted)).not.toContain("Smith");
    expect(storageTouched).toBe(false);
  });

  it("gives a finding with no auditor's date an improvement row due three months out", async () => {
    const r = await saveFindingsAction({
      rows: [
        {
          standard_id: "",
          severity: "major",
          finding:
            "No participant risk assessment was on file for three participants sampled.",
        },
      ],
    });
    expect(r.ok && r.saved).toBe(1);
    expect(inserted.find((i) => i.table === "improvements")!.row.due_on).toBe(
      "2027-01-18",
    );
  });
});
