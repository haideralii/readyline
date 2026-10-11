/**
 * Replay harness and pipeline (REQ-005 D-502, AC-5): fixtures round-trip
 * through a temp directory, a missing fixture fails with its key, and the
 * validate-retry-fallback path behaves as the REQ describes. No network.
 */
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { documentTypeById, sectionsFor } from "./catalogue";
import { buildContextPack } from "./context-pack";
import {
  extractJson,
  generateSection,
  validateReply,
} from "./generate-section";
import {
  createModelClient,
  FakeClient,
  MissingFixtureError,
  RecordingClient,
  ReplayClient,
} from "./model-client";
import { buildModelRequest, requestHash } from "./prompts";
import { loadReferenceCases } from "./reference-cases";

const dataset = getStandardsDataset();
const [reference] = loadReferenceCases();
const type = documentTypeById("governance-policy")!;
const section = sectionsFor(type).find((s) => s.id === "purpose")!;
const pack = buildContextPack({
  answers: reference.answers,
  result: reference.result,
  dataset,
  type,
  section,
});
const classNames = dataset.registrationGroups.map((g) => g.name);
const labels = { documentTypeId: type.id, sectionId: section.id };

const GOOD = JSON.stringify({
  sectionId: "purpose",
  usedFacts: ["tradingName", "structure", "states"],
  blocks: [
    {
      type: "paragraph",
      text: "This policy explains how Sunrise Supports, a sole trader working in New South Wales, is run and who is accountable for decisions.",
    },
    {
      type: "paragraph",
      text: "It supports the Governance and operational management standard.",
    },
  ],
});
const CLAIMY = GOOD.replace(
  "is run and who",
  "is fully compliant with the standards and who",
);
const WRONG_ID = GOOD.replace('"sectionId":"purpose"', '"sectionId":"scope"');

const tmp = mkdtempSync(join(tmpdir(), "readyline-fixtures-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("replay harness", () => {
  it("fails loudly without a fixture and never touches the network", async () => {
    const replay = new ReplayClient(tmp);
    await expect(
      replay.complete(buildModelRequest(pack, "m"), labels),
    ).rejects.toBeInstanceOf(MissingFixtureError);
  });

  it("records through a wrapped client and replays the same reply", async () => {
    const request = buildModelRequest(pack, "m");
    const recording = new RecordingClient(
      new FakeClient([GOOD]),
      tmp,
      () => new Date("2026-10-12T00:00:00Z"),
    );
    const first = await recording.complete(request, labels);
    expect(first.text).toBe(GOOD);
    expect(readdirSync(join(tmp, type.id, section.id))).toEqual([
      `${requestHash(request)}.json`,
    ]);
    const replay = new ReplayClient(tmp);
    const second = await replay.complete(request, labels);
    expect(second.text).toBe(GOOD);
    expect(second.usage).toEqual({ inputTokens: 100, outputTokens: 50 });
  });

  it("defaults to replay; record mode needs both the flag and a key", () => {
    expect(createModelClient({}, tmp).mode).toBe("replay");
    expect(createModelClient({ GENERATION_RECORD: "1" }, tmp).mode).toBe(
      "replay",
    );
    expect(createModelClient({ ANTHROPIC_API_KEY: "x" }, tmp).mode).toBe(
      "replay",
    );
    expect(
      createModelClient({ GENERATION_RECORD: "1", ANTHROPIC_API_KEY: "x" }, tmp)
        .mode,
    ).toBe("record");
  });
});

describe("validate, retry, fall back (AC-5)", () => {
  it("extracts JSON from fenced or chatty replies", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(extractJson('Here you go: {"a":1} thanks')).toBe('{"a":1}');
  });

  it("accepts a valid reply and reports readability", async () => {
    const out = await generateSection({
      pack,
      client: new FakeClient([GOOD]),
      model: "m",
      allowedPhrases: classNames,
    });
    expect(out.status).toBe("generated");
    expect(out.attempts).toBe(1);
    expect(out.usedFacts).toContain("tradingName");
    expect(out.readability?.grade).toBeGreaterThan(0);
  });

  it("rejects a compliance claim, retries with the problem, then accepts", async () => {
    const client = new FakeClient([CLAIMY, GOOD]);
    const out = await generateSection({
      pack,
      client,
      model: "m",
      allowedPhrases: classNames,
    });
    expect(out.status).toBe("generated");
    expect(out.attempts).toBe(2);
    expect(out.problems.join(" ")).toMatch(/claim/);
    expect(client.requests[1].user).toContain("previous reply was rejected");
  });

  it("falls back after two failures with the visible marker", async () => {
    const out = await generateSection({
      pack,
      client: new FakeClient(["not json", WRONG_ID]),
      model: "m",
    });
    expect(out.status).toBe("fallback");
    expect(out.attempts).toBe(2);
    expect(out.blocks[0]).toEqual({
      type: "callout",
      text: expect.stringMatching(/^Review and complete/),
    });
    expect(out.problems).toEqual([
      "reply was not valid JSON",
      'sectionId must be "purpose"',
    ]);
  });

  it("validateReply rejects schema violations with readable paths", () => {
    const v = validateReply(
      JSON.stringify({
        sectionId: "purpose",
        usedFacts: ["tradingName"],
        blocks: [{ type: "html", text: "x" }],
      }),
      pack,
      [],
    );
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.problems[0]).toMatch(/blocks/);
  });
});
