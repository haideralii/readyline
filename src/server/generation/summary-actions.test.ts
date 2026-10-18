// @vitest-environment node
/**
 * REQ-033 Session C (AC-C2, AC-C3 unit; D-2978, D-2982): "The summary is
 * still right" writes the change-log row with the day and the role into the
 * current version, clears the state and renders the file again at its path;
 * "Redraft the summary" sends the summary and the changed section (no
 * finding, no facts), refuses a reply above Year 6 and stores nothing then,
 * and otherwise makes version n+1 with the summary replaced and the state
 * cleared. The database is a small fake.
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentModel } from "@/lib/generator/document-model";

const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const SET = "33333333-3333-4333-8333-333333333333";
const VERSION_ID = "77777777-7777-4777-8777-777777777777";
const NEW_ID = "66666666-6666-4666-8666-666666666666";

const sample = JSON.parse(
  readFileSync("data/samples/complaints-policy.json", "utf8"),
) as DocumentModel;
// A summary without the generic callout or a bracket, as a drafted one reads.
const model: DocumentModel = {
  ...sample,
  sections: sample.sections.map((s) =>
    s.id === "plain-language-summary"
      ? {
          ...s,
          status: "generated" as const,
          blocks: [
            {
              type: "paragraph" as const,
              text: "This document is about how Example Supports works with you. You choose your supports. We listen to you. If something is wrong, tell us. We will put it right.",
            },
          ],
        }
      : s,
  ),
};

const logged: Record<string, unknown>[] = [];
let replyText = "";
let completeCalls: { user: string }[] = [];
let viewer: {
  user: { id: string };
  account: { id: string } | null;
  deleted: null;
} | null;
let redraftAllowed = true;
let writeAllowed = true;
let quotaAllowed = true;
type Row = Record<string, unknown>;
const inserted: { table: string; row: Row }[] = [];
const updated: { table: string; patch: Row }[] = [];
let storedVersions: Row[] = [];
let putObjects: string[] = [];

function fakeClient() {
  function from(table: string) {
    let patch: Row | null = null;
    let mode: "select" | "insert" | "update" = "select";
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      insert: (row: Row) => {
        mode = "insert";
        inserted.push({ table, row });
        return chain;
      },
      update: (p: Row) => {
        mode = "update";
        patch = p;
        return chain;
      },
      maybeSingle: async () => ({ data: null, error: null }),
      then: (resolve: (v: unknown) => void) => {
        if (mode === "update" && patch) {
          updated.push({ table, patch });
          if (table === "document_versions")
            Object.assign(storedVersions[0], patch);
        }
        resolve({ data: null, error: null });
      },
    };
    return chain;
  }
  return {
    from,
    rpc: async (name: string) =>
      name === "generation_quota_hit"
        ? { data: quotaAllowed, error: null }
        : { data: null, error: null },
  };
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/logging/logger", () => ({
  log: {
    info: (event: string, f: Record<string, unknown>) =>
      logged.push({ event, ...f }),
    warn: (event: string, f: Record<string, unknown>) =>
      logged.push({ event, ...f }),
  },
}));
vi.mock("@/server/accounts/queries", () => ({ getViewer: async () => viewer }));
vi.mock("@/lib/generator/model-client", () => ({
  createModelClient: () => ({
    mode: "fake",
    complete: async (request: { user: string }) => {
      completeCalls.push(request);
      return {
        text: replyText,
        usage: { inputTokens: 500, outputTokens: 80 },
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
vi.mock("@/server/generation/queries", () => ({
  getVersionSet: async () => ({
    id: SET,
    account_id: ACCOUNT,
    status: "ready",
  }),
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
  renderDocx: async () => new Uint8Array([1]).buffer,
}));
vi.mock("@/server/path/facts", () => ({
  loadFacts: async () => ({ name: "Sam Example", role: "Director" }),
}));
vi.mock("@/server/generation/store", () => ({
  SupabaseGenerationStore: class {
    async putObject(path: string) {
      putObjects.push(path);
    }
    async insertDocumentVersion(input: Row) {
      const row = { ...input, id: NEW_ID, created_at: "2026-10-19T00:00:00Z" };
      storedVersions = [row, ...storedVersions];
      return row;
    }
  },
}));

const { confirmSummaryAction, redraftSummaryAction } =
  await import("./summary-actions");
const {
  SUMMARY_NOTHING_TO_CHECK,
  SUMMARY_CONFIRM_AUDIT_ACTION,
  SUMMARY_REDRAFT_AUDIT_ACTION,
} = await import("@/lib/registers/summary-check");
const { REDRAFT_REFUSED_MESSAGE } = await import("@/lib/generator/redraft");

const target = { setId: SET, typeId: sample.typeId };
const shortSummary = JSON.stringify({
  sectionId: "plain-language-summary",
  blocks: [
    {
      type: "paragraph",
      text: "This document is about how Example Supports works with you. You choose your supports. We listen to you. Family or friends can speak for you. If something is wrong, tell us.",
    },
  ],
});

beforeEach(() => {
  logged.length = 0;
  completeCalls = [];
  inserted.length = 0;
  updated.length = 0;
  putObjects = [];
  viewer = { user: { id: USER }, account: { id: ACCOUNT }, deleted: null };
  redraftAllowed = true;
  writeAllowed = true;
  quotaAllowed = true;
  storedVersions = [
    {
      id: VERSION_ID,
      version_set_id: SET,
      account_id: ACCOUNT,
      document_type_id: sample.typeId,
      version: 2,
      status: "ready",
      storage_path: `${ACCOUNT}/${SET}/${sample.typeId}.v2.docx`,
      model,
      created_at: "2026-10-18T00:00:00Z",
      adopted_on: null,
      approver_name: null,
      approver_role: null,
      summary_check_section_id: "scope",
      summary_check_on: "2026-10-18",
    },
  ];
  replyText = shortSummary;
});

describe("confirmSummaryAction (FR-C2, AC-C2)", () => {
  it("writes the change-log row with the day and the role into the current version, clears the state and renders the file again", async () => {
    const r = await confirmSummaryAction(target);
    expect(r).toEqual({
      ok: true,
      version: 2,
      href: `/documents/${SET}/${sample.typeId}`,
    });
    expect(putObjects).toEqual([`${ACCOUNT}/${SET}/${sample.typeId}.v2.docx`]);
    const patch = updated.find((u) => u.table === "document_versions")!.patch;
    expect(patch.summary_check_section_id).toBeNull();
    expect(patch.summary_check_on).toBeNull();
    const m = patch.model as DocumentModel;
    expect(m.version).toBe("1");
    const rows = (
      m.sections
        .find((s) => s.id === "change-log")!
        .blocks.find((b) => b.type === "table") as {
        rows: string[][];
      }
    ).rows;
    expect(rows.at(-1)![2]).toBe(
      "In plain words confirmed after section 2 changed",
    );
    expect(rows.at(-1)![3]).toBe("Sam Example, Director");
    expect(inserted.find((i) => i.table === "audit_log")?.row).toMatchObject({
      action: SUMMARY_CONFIRM_AUDIT_ACTION,
      target: `${sample.typeId}:2:scope`,
    });
    expect(storedVersions).toHaveLength(1);
    expect(completeCalls).toHaveLength(0);
  });

  it("says when there is nothing to check, and refuses a signed-out caller", async () => {
    storedVersions[0].summary_check_section_id = null;
    storedVersions[0].summary_check_on = null;
    expect(await confirmSummaryAction(target)).toEqual({
      ok: false,
      message: SUMMARY_NOTHING_TO_CHECK,
    });
    viewer = null;
    const r = await confirmSummaryAction(target);
    expect(r.ok).toBe(false);
    expect(updated).toEqual([]);
  });
});

describe("redraftSummaryAction (FR-C2, AC-C3; D-2982)", () => {
  it("sends the summary and the changed section and nothing else, then makes version 3 with the state cleared", async () => {
    const r = await redraftSummaryAction(target);
    expect(r).toEqual({
      ok: true,
      version: 3,
      href: `/documents/${SET}/${sample.typeId}`,
    });
    expect(completeCalls).toHaveLength(1);
    const user = completeCalls[0].user;
    expect(user).toContain("<<<CURRENT SECTION>>>");
    expect(user).toContain("<<<CHANGED SECTION 2 Scope>>>");
    expect(user).toContain("This policy covers Example Supports");
    expect(user).not.toContain("<<<FACTS>>>");
    expect(user).not.toContain("<<<FINDING>>>");
    expect(user).not.toContain("<<<STANDARD>>>");
    expect(storedVersions[0]).toMatchObject({
      version: 3,
      summary_check_section_id: null,
      summary_check_on: null,
    });
    const m = storedVersions[0].model as DocumentModel;
    expect(
      (
        m.sections.find((s) => s.id === "plain-language-summary")!
          .blocks[0] as { text: string }
      ).text,
    ).toContain("Family or friends can speak for you");
    const rows = (
      m.sections
        .find((s) => s.id === "change-log")!
        .blocks.find((b) => b.type === "table") as {
        rows: string[][];
      }
    ).rows;
    expect(rows.at(-1)![2]).toBe(
      "In plain words redrafted after section 2 changed; approved by [role]",
    );
    expect(
      inserted.find((i) => i.table === "generation_log")?.row,
    ).toMatchObject({
      section_id: "plain-language-summary",
      status: "generated",
      source: "summary:scope",
    });
    expect(inserted.find((i) => i.table === "audit_log")?.row).toMatchObject({
      action: SUMMARY_REDRAFT_AUDIT_ACTION,
      target: `${sample.typeId}:3:scope`,
    });
  });

  it("refuses a reply above Year 6 and stores nothing (AC-C3)", async () => {
    replyText = JSON.stringify({
      sectionId: "plain-language-summary",
      blocks: [
        {
          type: "paragraph",
          text: "Notwithstanding the aforementioned organisational commitments, participants and their authorised representatives are entitled to initiate complaint proceedings through the established escalation mechanisms, whereupon the provider undertakes comprehensive investigation procedures in accordance with regulatory obligations and documented methodologies, subsequently communicating determinations transparently.",
        },
      ],
    });
    const r = await redraftSummaryAction(target);
    expect(r).toEqual({ ok: false, message: REDRAFT_REFUSED_MESSAGE });
    expect(storedVersions).toHaveLength(1);
    expect(
      inserted.find((i) => i.table === "generation_log")?.row,
    ).toMatchObject({ status: "fallback" });
    expect(inserted.find((i) => i.table === "audit_log")).toBeUndefined();
  });

  it("refuses a summary that names the audit, and spends no call over the limit or the quota", async () => {
    replyText = JSON.stringify({
      sectionId: "plain-language-summary",
      blocks: [
        {
          type: "paragraph",
          text: "We changed this after the audit. You can ask us about it.",
        },
      ],
    });
    expect(await redraftSummaryAction(target)).toEqual({
      ok: false,
      message: REDRAFT_REFUSED_MESSAGE,
    });
    redraftAllowed = false;
    completeCalls = [];
    expect((await redraftSummaryAction(target)).ok).toBe(false);
    redraftAllowed = true;
    quotaAllowed = false;
    expect((await redraftSummaryAction(target)).ok).toBe(false);
    expect(completeCalls).toHaveLength(0);
  });
});
