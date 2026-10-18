// @vitest-environment node
/**
 * REQ-035 AC-2, AC-3, AC-4, AC-7 (D-2962 to D-2965): the gap check action
 * with fakes for the viewer, the database, the limiter, the quota and the
 * model. A pasted fixture and its PDF and Word renderings give the same
 * rows; no storage call is made and no log line carries a word of the text;
 * a text naming a person is refused before any request; the fourth check in
 * an hour is refused; the quota is spent only for a real model call.
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeGapCheckReply } from "@/lib/gap-check/fake";
import type { ModelRequest } from "@/lib/generator/prompts";

type Viewer = {
  account: { id: string; trading_name?: string } | null;
  deleted: unknown;
  user: { id: string };
};
let viewer: Viewer | null = {
  account: { id: "acc-1" },
  deleted: null,
  user: { id: "user-1" },
};
let allowed = true;
let mode: "fake" | "record" | "replay" = "fake";
let quotaAnswer: boolean | null = true;
const quotaCalls: string[] = [];
const completeCalls: ModelRequest[] = [];
const logged: Record<string, unknown>[] = [];
const inserted: { table: string; row: unknown }[] = [];
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
  checkGapCheckAllowed: async () => allowed,
}));
vi.mock("@/lib/generator/model-client", () => ({
  createModelClient: () => ({
    get mode() {
      return mode;
    },
    complete: async (request: ModelRequest) => {
      completeCalls.push(request);
      const text = fakeGapCheckReply(request);
      if (text === null) throw new Error("not a gap-check request");
      return {
        text,
        usage: { inputTokens: 900, outputTokens: 200 },
        stopReason: "end_turn",
      };
    },
  }),
}));
vi.mock("@/server/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    rpc: async (fn: string, args: { p_account: string }) => {
      quotaCalls.push(`${fn}:${args.p_account}`);
      return { data: quotaAnswer, error: null };
    },
  }),
}));
vi.mock("@/server/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: (table: string) => {
      const api = {
        insert(row: unknown) {
          inserted.push({ table, row });
          return api;
        },
        select() {
          return api;
        },
        async single() {
          return { data: { id: "check-1" }, error: null };
        },
        then(resolve: (v: unknown) => void) {
          resolve({ data: null, error: null });
        },
      };
      return api;
    },
    get storage() {
      storageTouched = true;
      throw new Error("storage must never be touched (D-2962)");
    },
  }),
}));

const { runGapCheckAction } = await import("./actions");

const policy = readFileSync("fixtures/gap-check/sample-policy.txt", "utf8");
const TYPE = "complaints-management-policy-and-register";

function form(
  fields: Record<string, string>,
  file?: { name: string; type: string; bytes: Uint8Array },
) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  if (file)
    fd.set(
      "file",
      new File([file.bytes as BlobPart], file.name, { type: file.type }),
    );
  return fd;
}

beforeEach(() => {
  viewer = { account: { id: "acc-1" }, deleted: null, user: { id: "user-1" } };
  allowed = true;
  mode = "fake";
  quotaAnswer = true;
  quotaCalls.length = 0;
  completeCalls.length = 0;
  logged.length = 0;
  inserted.length = 0;
  storageTouched = false;
});

const sectionRows = () =>
  inserted.find((i) => i.table === "gap_check_sections")!.row as {
    state: string;
    section_id: string;
    reason: string;
  }[];

describe("runGapCheckAction (REQ-035)", () => {
  it("AC-1: a pasted policy gives five covered and the rest missing, stored as rows with one audit line", async () => {
    const r = await runGapCheckAction(
      form({
        documentTypeId: TYPE,
        title: "Complaints policy 2023",
        text: policy,
      }),
    );
    expect(r).toEqual({ ok: true, id: "check-1" });
    expect(completeCalls).toHaveLength(1);
    const check = inserted.find((i) => i.table === "gap_checks")!.row as Record<
      string,
      unknown
    >;
    expect(check).toMatchObject({
      account_id: "acc-1",
      document_type_id: TYPE,
      title: "Complaints policy 2023",
      covered: 5,
      partly: 0,
      prompt_version: "gap-check-1",
    });
    const rows = sectionRows();
    expect(
      rows.filter((x) => x.state === "covered").map((x) => x.section_id),
    ).toEqual([
      "purpose",
      "scope",
      "definitions",
      "policy-statement",
      "responsibilities",
    ]);
    expect(rows.length).toBe(
      (check.covered as number) + (check.missing as number),
    );
    expect(inserted.find((i) => i.table === "audit_log")!.row).toMatchObject({
      action: "gap-check.ran",
      actor_user_id: "user-1",
      target: "check-1",
    });
    // The fake mode spends no quota.
    expect(quotaCalls).toEqual([]);
  });

  it("AC-2: the PDF and the Word renderings give the same rows; no storage call; the log carries no word of the text", async () => {
    const results: string[][] = [];
    for (const name of [
      "sample-policy.pdf",
      "sample-policy.docx",
      "sample-policy.txt",
    ]) {
      inserted.length = 0;
      const type = name.endsWith(".pdf")
        ? "application/pdf"
        : name.endsWith(".docx")
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "text/plain";
      const r = await runGapCheckAction(
        form(
          { documentTypeId: TYPE, title: `From ${name}`, text: "" },
          {
            name,
            type,
            bytes: new Uint8Array(readFileSync(`fixtures/gap-check/${name}`)),
          },
        ),
      );
      expect(r.ok, name).toBe(true);
      results.push(sectionRows().map((x) => `${x.section_id}:${x.state}`));
    }
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
    expect(storageTouched).toBe(false);
    const all = JSON.stringify(logged);
    for (const phrase of [
      "welcomes feedback",
      "twenty business days",
      "Example Supports",
    ])
      expect(all).not.toContain(phrase);
    expect(
      logged.filter((l) => l.event === "gap-check.ran").map((l) => l.source),
    ).toEqual(["pdf", "docx", "txt"]);
  });

  it("AC-3: a text naming a person is refused before any request, with the detector's sentence and the next step", async () => {
    const r = await runGapCheckAction(
      form({
        documentTypeId: TYPE,
        title: "Complaints policy",
        text: `${policy}\n\nA complaint from Mr J. Smith was handled last year.`,
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain("person's name");
      expect(r.message).toContain(
        "Remove the names or details it points to, then run the check again.",
      );
    }
    expect(completeCalls).toHaveLength(0);
    expect(inserted).toHaveLength(0);
    expect(logged.find((l) => l.event === "gap-check.refused")).toMatchObject({
      rule: "name",
    });
  });

  it("AC-7: the fourth check in an hour is refused with the limiter's sentence, before any request", async () => {
    allowed = false;
    const r = await runGapCheckAction(
      form({ documentTypeId: TYPE, title: "Complaints policy", text: policy }),
    );
    expect(r).toEqual({
      ok: false,
      message: "You have run three checks this hour. Try again in an hour.",
    });
    expect(completeCalls).toHaveLength(0);
  });

  it("spends the daily quota only for a real model call, and stops when it is used up", async () => {
    mode = "record";
    const ok = await runGapCheckAction(
      form({ documentTypeId: TYPE, title: "Complaints policy", text: policy }),
    );
    expect(ok.ok).toBe(true);
    expect(quotaCalls).toEqual(["generation_quota_hit:acc-1"]);
    quotaAnswer = false;
    completeCalls.length = 0;
    const stopped = await runGapCheckAction(
      form({ documentTypeId: TYPE, title: "Complaints policy", text: policy }),
    );
    expect(stopped.ok).toBe(false);
    if (!stopped.ok) expect(stopped.message).toMatch(/today|quota|tomorrow/i);
    expect(completeCalls).toHaveLength(0);
  });

  it("refuses a signed-out caller, a caller without an account, an unknown type and an empty document in words", async () => {
    viewer = null;
    expect(
      await runGapCheckAction(
        form({ documentTypeId: TYPE, title: "x", text: policy }),
      ),
    ).toEqual({
      ok: false,
      message: "Sign in to check a document.",
    });
    viewer = { account: null, deleted: null, user: { id: "u" } };
    expect(
      await runGapCheckAction(
        form({ documentTypeId: TYPE, title: "x", text: policy }),
      ),
    ).toEqual({
      ok: false,
      message: "Only the owner runs a check.",
    });
    viewer = {
      account: { id: "acc-1" },
      deleted: null,
      user: { id: "user-1" },
    };
    expect(
      await runGapCheckAction(
        form({ documentTypeId: "no-such-type", title: "x", text: policy }),
      ),
    ).toEqual({
      ok: false,
      message: "Pick which Readyline document yours stands for.",
    });
    expect(
      await runGapCheckAction(
        form({ documentTypeId: TYPE, title: "x", text: "   " }),
      ),
    ).toEqual({
      ok: false,
      message: "Paste the document's text or choose a file.",
    });
    expect(completeCalls).toHaveLength(0);
  });
  it("takes the provider's own trading name out of the text the gate reads (a three-word business name is not a person)", async () => {
    viewer = {
      account: { id: "acc-1", trading_name: "Bright Futures Care" },
      deleted: null,
      user: { id: "user-1" },
    };
    const r = await runGapCheckAction(
      form({
        documentTypeId: TYPE,
        title: "Bright Futures Care complaints policy",
        text: `${policy}\n\nBright Futures Care is the name we trade under.`,
      }),
    );
    expect(r).toEqual({ ok: true, id: "check-1" });
    expect(completeCalls).toHaveLength(1);
    // The model still receives the whole text; only the gate's reading drops the name.
    expect(completeCalls[0].blocks.section).toContain("Bright Futures Care");
  });
});
