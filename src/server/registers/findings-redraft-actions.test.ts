// @vitest-environment node
/**
 * REQ-033 Session B (AC-B1, AC-B2, AC-B4, AC-B6, AC-B7; SR-B1 to SR-B5): the
 * draft runs the gate before the model, spends the limiter and the quota only
 * when it calls, logs the finding's reference and never its words, refuses a
 * reply that fails the redraft checks, and stores nothing; the accept checks
 * the blocks again, inserts version n+1 with its change-log row through the
 * service role, links the finding and improvement rows and writes one audit
 * line. The database is a small fake over the tables the actions touch.
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentModel } from "@/lib/generator/document-model";
import type { Block } from "@/lib/generator/section-schema";

const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const SET = "33333333-3333-4333-8333-333333333333";
const FINDING_ID = "44444444-4444-4444-8444-444444444444";
const IMPROVEMENT_ID = "55555555-5555-4555-8555-555555555555";
const VERSION_ID = "66666666-6666-4666-8666-666666666666";

const sample = JSON.parse(
  readFileSync("data/samples/complaints-policy.json", "utf8"),
) as DocumentModel;
const scope = sample.sections.find((s) => s.id === "scope")!;
function goodBlocks(): Block[] {
  const [first, ...rest] = scope.blocks;
  return [
    {
      type: "paragraph",
      text: `${(first as { text: string }).text} Family members, nominees and advocates can complain for a participant, and we tell each participant this when supports begin.`,
    },
    ...rest,
  ];
}

const logged: Record<string, unknown>[] = [];
let replyText = "";
let completeCalls: { user: string; system: string }[] = [];
let viewer: {
  user: { id: string };
  account: { id: string } | null;
  deleted: null;
} | null;
let subscribed = true;
let redraftAllowed = true;
let writeAllowed = true;
let quotaAllowed = true;

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};
const inserted: { table: string; row: Row }[] = [];
const updated: { table: string; patch: Row; filters: Row }[] = [];
let storedVersions: Row[] = [];
let putObjects: string[] = [];

/** A chainable fake over the few query shapes the actions use. */
function fakeClient() {
  function from(table: string) {
    const filters: Row = {};
    let patch: Row | null = null;
    let mode: "select" | "insert" | "update" = "select";
    const rows = () =>
      (tables[table] ?? []).filter((r) =>
        Object.entries(filters).every(([k, v]) => r[k] === v),
      );
    const chain: Record<string, unknown> = {
      select: () => chain,
      order: () => chain,
      limit: () => chain,
      eq: (k: string, v: unknown) => {
        filters[k] = v;
        return chain;
      },
      insert: (row: Row | Row[]) => {
        mode = "insert";
        for (const r of Array.isArray(row) ? row : [row]) {
          inserted.push({ table, row: r });
          (tables[table] ??= []).push(r);
        }
        return chain;
      },
      update: (p: Row) => {
        mode = "update";
        patch = p;
        return chain;
      },
      maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
      single: async () => ({ data: rows()[0] ?? null, error: null }),
      then: (resolve: (v: unknown) => void) => {
        if (mode === "update" && patch) {
          for (const r of rows()) Object.assign(r, patch);
          updated.push({ table, patch, filters: { ...filters } });
        }
        resolve({ data: mode === "select" ? rows() : null, error: null });
      },
    };
    return chain;
  }
  return {
    from,
    rpc: async (name: string) => {
      if (name === "generation_quota_hit")
        return { data: quotaAllowed, error: null };
      return { data: null, error: null };
    },
  };
}

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
vi.mock("@/lib/generator/model-client", () => ({
  createModelClient: () => ({
    mode: "fake",
    complete: async (request: { user: string; system: string }) => {
      completeCalls.push(request);
      if (replyText === "THROW") throw new Error("MissingFixtureError");
      return {
        text: replyText,
        usage: { inputTokens: 900, outputTokens: 400 },
        stopReason: "end_turn",
      };
    },
  }),
}));
vi.mock("@/server/supabase/server", () => ({
  createSupabaseServerClient: async () => fakeClient(),
}));
vi.mock("@/server/supabase/admin", () => ({
  createSupabaseAdminClient: () => fakeClient(),
}));
vi.mock("@/server/auth/rate-limit", () => ({
  checkRedraftAllowed: async () => redraftAllowed,
  checkRegisterWriteAllowed: async () => writeAllowed,
}));
vi.mock("@/server/registers/queries", () => ({
  hasActiveSubscription: async () => subscribed,
}));
vi.mock("@/server/checklist/queries", () => ({
  latestReadySet: async () => ({
    setId: SET,
    documentTypeIds: [sample.typeId],
  }),
}));
vi.mock("@/server/generation/queries", () => ({
  listDocumentVersions: async () => storedVersions,
}));
vi.mock("@/server/generation/read-fill", () => ({
  readFillInputs: async () => ({ facts: {}, abn: null, nextReview: new Map() }),
  filledForRead: (row: { model: DocumentModel }) => row.model,
}));
vi.mock("@/server/generation/rerender", () => ({
  refreshSetSummary: async () => ({ documents: 1 }),
}));
vi.mock("@/lib/generator/render-docx", () => ({
  renderDocx: async () => new Uint8Array([1, 2, 3]).buffer,
}));
vi.mock("@/server/generation/store", () => ({
  SupabaseGenerationStore: class {
    async putObject(path: string) {
      putObjects.push(path);
    }
    async insertDocumentVersion(input: Row) {
      const row = {
        ...input,
        id: VERSION_ID,
        created_at: "2026-10-19T00:00:00Z",
      };
      storedVersions = [row, ...storedVersions];
      return row;
    }
  },
}));

const { draftRedraftAction, acceptRedraftAction } =
  await import("./findings-redraft-actions");
const {
  REDRAFT_AUDIT_ACTION,
  REDRAFT_LIMITED,
  REDRAFT_NEEDS_SUBSCRIPTION,
  REDRAFT_NO_SECTION,
} = await import("@/lib/registers/findings-redraft");
const { REDRAFT_REFUSED_MESSAGE } = await import("@/lib/generator/redraft");

const finding =
  "The scope of the complaints policy does not say that family members and advocates can complain on a participant's behalf. The provider must widen the scope and tell participants.";

function findingRow(words = finding): Row {
  return {
    id: FINDING_ID,
    account_id: ACCOUNT,
    reference: "FND-0001",
    standard_id: "core.governance.feedback-and-complaints-management",
    // The indicator's words map to the Scope section of the complaints policy (FR-4's word overlap).
    indicator:
      "The scope of the policy covers who can complain, including family members, nominees and advocates acting for a participant.",
    severity: "minor",
    finding: words,
    due_on: null,
    status: "open",
    addressed_on: null,
    addressed_by_role: "",
    verified_on: null,
    improvement_id: IMPROVEMENT_ID,
    created_by: USER,
    created_at: "2026-10-18T00:00:00Z",
    updated_at: "2026-10-18T00:00:00Z",
  };
}

beforeEach(() => {
  logged.length = 0;
  completeCalls = [];
  inserted.length = 0;
  updated.length = 0;
  putObjects = [];
  viewer = { user: { id: USER }, account: { id: ACCOUNT }, deleted: null };
  subscribed = true;
  redraftAllowed = true;
  writeAllowed = true;
  quotaAllowed = true;
  for (const k of Object.keys(tables)) delete tables[k];
  tables.findings = [findingRow()];
  tables.improvements = [
    {
      id: IMPROVEMENT_ID,
      account_id: ACCOUNT,
      changed:
        "Corrective action for FND-0001: to be recorded here when it is done.",
    },
  ];
  storedVersions = [
    {
      id: "77777777-7777-4777-8777-777777777777",
      version_set_id: SET,
      account_id: ACCOUNT,
      document_type_id: sample.typeId,
      version: 1,
      status: "ready",
      storage_path: "x",
      model: sample,
      created_at: "2026-10-13T00:00:00Z",
      adopted_on: "2026-10-14",
      approver_name: "Sam Example",
      approver_role: "Owner",
    },
  ];
  replyText = JSON.stringify({ sectionId: "scope", blocks: goodBlocks() });
});

const target = { findingId: FINDING_ID, typeId: sample.typeId };

describe("draftRedraftAction (FR-B2, FR-B3, SR-B1, SR-B3, SR-B5)", () => {
  it("shows the current section and the redraft, logs the reference and no words, stores nothing", async () => {
    const r = await draftRedraftAction(target);
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    expect(r.title).toBe(sample.title);
    expect(r.sectionNumber).toBe("2");
    expect(r.heading).toBe("Scope");
    expect(r.version).toBe(2);
    expect(r.current).toEqual(scope.blocks);
    expect((r.proposed[0] as { text: string }).text).toContain(
      "advocates can complain",
    );
    expect(completeCalls).toHaveLength(1);
    expect(completeCalls[0].user).toContain("<<<FINDING>>>");
    expect(completeCalls[0].user).not.toContain("<<<FACTS>>>");
    const logRow = inserted.find((i) => i.table === "generation_log")!;
    expect(logRow.row).toMatchObject({
      account_id: ACCOUNT,
      version_set_id: SET,
      document_type_id: sample.typeId,
      section_id: "scope",
      status: "generated",
      source: "redraft:FND-0001",
      input_tokens: 900,
    });
    expect(JSON.stringify(inserted)).not.toContain("widen the scope");
    expect(JSON.stringify(logged)).not.toContain("widen the scope");
    expect(inserted.filter((i) => i.table !== "generation_log")).toEqual([]);
    expect(storedVersions).toHaveLength(1);
  });

  it("runs the gate again and never calls the model on a flagged finding (SR-B1)", async () => {
    tables.findings = [
      findingRow("A support note for Mr J. Smith named him in full."),
    ];
    const r = await draftRedraftAction(target);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("person's name");
    expect(completeCalls).toHaveLength(0);
  });

  it("refuses a reply that names the audit, logs it as a fallback and changes nothing (D-2957)", async () => {
    const blocks = goodBlocks();
    blocks.push({
      type: "paragraph",
      text: "We changed this after the audit found a gap.",
    });
    replyText = JSON.stringify({ sectionId: "scope", blocks });
    const r = await draftRedraftAction(target);
    expect(r).toEqual({ ok: false, message: REDRAFT_REFUSED_MESSAGE });
    const logRow = inserted.find((i) => i.table === "generation_log")!;
    expect(logRow.row).toMatchObject({
      status: "fallback",
      failure_kind: "gate",
    });
    expect(storedVersions).toHaveLength(1);
  });

  it("answers plainly when the model cannot be reached", async () => {
    replyText = "THROW";
    const r = await draftRedraftAction(target);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/nothing was changed/);
  });

  it("refuses without a subscription, over the hourly limit or past the daily quota, calling the model in none (SR-B3, AC-B7)", async () => {
    subscribed = false;
    expect(await draftRedraftAction(target)).toEqual({
      ok: false,
      message: REDRAFT_NEEDS_SUBSCRIPTION,
    });
    subscribed = true;
    redraftAllowed = false;
    expect(await draftRedraftAction(target)).toEqual({
      ok: false,
      message: REDRAFT_LIMITED,
    });
    redraftAllowed = true;
    quotaAllowed = false;
    const q = await draftRedraftAction(target);
    expect(q.ok).toBe(false);
    if (!q.ok) expect(q.message).toMatch(/today's document generations/);
    expect(completeCalls).toHaveLength(0);
  });

  it("says when the finding maps to no section Readyline drafted (AC-B8)", async () => {
    const r = await draftRedraftAction({
      findingId: FINDING_ID,
      typeId: "no-such-document",
    });
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect([
        REDRAFT_NO_SECTION,
        "This document is not in your pack, so there is nothing to redraft.",
      ]).toContain(r.message);
    expect(completeCalls).toHaveLength(0);
  });
});

describe("acceptRedraftAction (FR-B5, FR-B6, SR-B4, AC-B2)", () => {
  it("inserts version 2 with the change-log row, links the finding and improvement rows and writes one audit line", async () => {
    const r = await acceptRedraftAction({ ...target, blocks: goodBlocks() });
    expect(r).toEqual({
      ok: true,
      version: 2,
      href: `/documents/${SET}/${sample.typeId}`,
    });
    expect(storedVersions[0]).toMatchObject({
      version: 2,
      document_type_id: sample.typeId,
      account_id: ACCOUNT,
      version_set_id: SET,
    });
    expect(putObjects[0]).toMatch(/\.v2\.docx$/);
    const model = storedVersions[0].model as DocumentModel;
    expect(model.version).toBe("2");
    const log = model.sections.find((s) => s.id === "change-log")!;
    const rows = (
      log.blocks.find((b) => b.type === "table") as { rows: string[][] }
    ).rows;
    expect(rows.at(-1)![2]).toBe(
      "Section 2 Scope redrafted after audit finding FND-0001; approved by [role]",
    );
    expect(rows.at(-1)![3]).toBe("[name]");
    expect(rows[0][3]).toBe("Sam Example");
    expect(
      (
        model.sections.find((s) => s.id === "scope")!.blocks[0] as {
          text: string;
        }
      ).text,
    ).toContain("advocates can complain");
    expect(updated.find((u) => u.table === "findings")?.patch).toEqual({
      redraft_version_id: VERSION_ID,
      redraft_section_id: "scope",
    });
    expect(updated.find((u) => u.table === "improvements")?.patch.changed).toBe(
      `Corrective action for FND-0001: to be recorded here when it is done.\nSection 2 of ${sample.title} redrafted (version 2).`,
    );
    expect(inserted.find((i) => i.table === "audit_log")?.row).toMatchObject({
      action: REDRAFT_AUDIT_ACTION,
      target: `${sample.typeId}:2:FND-0001`,
    });
    expect(
      inserted.find((i) => i.table === "register_events")?.row,
    ).toMatchObject({
      register: "findings",
      kind: "updated",
    });
  });

  it("checks the blocks again and refuses a redraft that quotes the finding or drops the provider's name, storing nothing", async () => {
    const quoted = goodBlocks();
    quoted.push({ type: "paragraph", text: finding.split(". ")[0] + "." });
    expect(await acceptRedraftAction({ ...target, blocks: quoted })).toEqual({
      ok: false,
      message: REDRAFT_REFUSED_MESSAGE,
    });
    const nameless = goodBlocks().map((b) =>
      b.type === "paragraph"
        ? { ...b, text: b.text.split("Example Supports").join("we") }
        : b.type === "table"
          ? {
              ...b,
              rows: b.rows.map((r) =>
                r.map((c) => c.split("Example Supports").join("we")),
              ),
            }
          : b,
    ) as Block[];
    expect(await acceptRedraftAction({ ...target, blocks: nameless })).toEqual({
      ok: false,
      message: REDRAFT_REFUSED_MESSAGE,
    });
    expect(storedVersions).toHaveLength(1);
    expect(inserted).toEqual([]);
  });

  it("refuses an unknown block shape before anything is read", async () => {
    const r = await acceptRedraftAction({
      ...target,
      blocks: [{ type: "heading", text: "Scope" }],
    });
    expect(r).toEqual({ ok: false, message: REDRAFT_REFUSED_MESSAGE });
  });

  it("leaves the plain-words summary to check on the new version (REQ-033 Session C AC-C1, D-2977)", async () => {
    const r = await acceptRedraftAction({ ...target, blocks: goodBlocks() });
    expect(r.ok).toBe(true);
    expect(storedVersions[0]).toMatchObject({
      summary_check_section_id: "scope",
    });
    expect(String(storedVersions[0].summary_check_on)).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });

  it("leaves the earlier change-log rows bracketed when the earlier version was never adopted", async () => {
    storedVersions = [
      {
        ...storedVersions[0],
        adopted_on: null,
        approver_name: null,
        approver_role: null,
      },
    ];
    const r = await acceptRedraftAction({ ...target, blocks: goodBlocks() });
    expect(r.ok).toBe(true);
    const model = storedVersions[0].model as DocumentModel;
    const log = model.sections.find((s) => s.id === "change-log")!;
    const rows = (
      log.blocks.find((b) => b.type === "table") as { rows: string[][] }
    ).rows;
    expect(rows[0][3]).toBe("[name]");
  });
});
