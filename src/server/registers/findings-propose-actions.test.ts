// @vitest-environment node
/**
 * REQ-033 FR-4 (D-2934, D-2937): the proposal goes to the model only after
 * the gate, the reply is checked against the dataset, the log carries no
 * words, and a missing or unusable reply is "no suggestion", never an error.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStandardsDataset } from "@/lib/standards/dataset";

const logged: Record<string, unknown>[] = [];
let replyText = "";
let completeCalls: { user: string; system: string }[] = [];
let viewer: { account: { id: string } | null; deleted: null } | null = {
  account: { id: "acc-1" },
  deleted: null,
};

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
        usage: { inputTokens: 900, outputTokens: 20 },
        stopReason: "end_turn",
      };
    },
  }),
}));

const { proposeStandardAction } = await import("./findings-propose-actions");
const { parseProposal } = await import("@/lib/registers/findings-propose");
const incident = getStandardsDataset().standards.find(
  (s) => s.name === "Incident management",
)!;

beforeEach(() => {
  logged.length = 0;
  completeCalls = [];
  viewer = { account: { id: "acc-1" }, deleted: null };
});

describe("proposeStandardAction", () => {
  it("sends the finding after the gate and returns the standard the model names, checked against the dataset", async () => {
    replyText = `{"standardId": "${incident.id}"}`;
    const r = await proposeStandardAction({
      finding:
        "The incident register showed no record of the Commission being told.",
    });
    expect(r).toEqual({
      ok: true,
      standardId: incident.id,
      name: "Incident management",
    });
    expect(completeCalls).toHaveLength(1);
    expect(completeCalls[0].user).toContain(incident.id);
    expect(completeCalls[0].user).toContain("<<<");
    expect(JSON.stringify(logged)).not.toContain("incident register");
    expect(logged[0]).toMatchObject({
      event: "findings.standard.proposed",
      proposed: true,
    });
  });

  it("never sends a flagged finding, and answers with the detector's message", async () => {
    replyText = `{"standardId": "${incident.id}"}`;
    const r = await proposeStandardAction({
      finding: "A support note for Mr J. Smith named him in full.",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("person's name");
    expect(completeCalls).toHaveLength(0);
  });

  it("treats an unknown id, an empty id or a missing fixture as no suggestion", async () => {
    replyText = `{"standardId": "core.made.up"}`;
    expect(
      (await proposeStandardAction({ finding: "Something about records." })).ok,
    ).toBe(false);
    replyText = `{"standardId": ""}`;
    expect(
      (await proposeStandardAction({ finding: "Something about records." })).ok,
    ).toBe(false);
    replyText = "THROW";
    const r = await proposeStandardAction({
      finding: "Something about records.",
    });
    expect(r).toEqual({
      ok: false,
      message: "No suggestion this time. Pick the standard from the list.",
    });
    expect(logged.at(-1)).toMatchObject({
      event: "findings.standard.unavailable",
    });
  });

  it("reads a JSON reply, a bare id in prose, and nothing from noise", () => {
    expect(
      parseProposal(`{"standardId":"core.governance.incident-management"}`),
    ).toBe("core.governance.incident-management");
    expect(
      parseProposal("I think core.governance.incident-management fits."),
    ).toBe("core.governance.incident-management");
    expect(parseProposal("no idea")).toBe("");
  });
});
