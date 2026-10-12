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
      text: "Sunrise Supports is a sole trader in New South Wales. This policy explains how we run the business. It names who makes each decision.",
    },
    {
      type: "paragraph",
      text: "It supports the Governance and operational management standard.",
    },
  ],
});
const CLAIMY = GOOD.replace(
  "how we run the business",
  "that we are fully compliant with the standards",
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

  it("R-5: a readability fail is a validation problem with the house-style retry instruction, then the fallback", async () => {
    const dense = JSON.stringify({
      sectionId: "purpose",
      usedFacts: ["tradingName"],
      blocks: [
        {
          type: "paragraph",
          text: "Notwithstanding the aforementioned organisational considerations, the comprehensive implementation of multidisciplinary governance arrangements necessitates the systematic utilisation of standardised documentation methodologies across all operational jurisdictions.",
        },
      ],
    });
    const client = new FakeClient([dense, GOOD]);
    const out = await generateSection({
      pack,
      client,
      model: "m",
      allowedPhrases: classNames,
    });
    expect(out.status).toBe("generated");
    expect(out.attempts).toBe(2);
    expect(out.problems[0]).toMatch(
      /readability grade \d+(\.\d+)? is above 11: shorten sentences to under 20 words and use common words/,
    );
    expect(client.requests[1].user).toContain(
      "shorten sentences to under 20 words",
    );
    const twice = await generateSection({
      pack,
      client: new FakeClient([dense, dense]),
      model: "m",
    });
    expect(twice.status).toBe("fallback");
  });

  it("R-6: a reply cut at the output cap is reported with its token count and never retried", async () => {
    const client = new FakeClient([
      {
        text: '{"sectionId":"purpose","usedFacts":["tradingName"],"blocks":[{"type":"paragraph","text":"We keep',
        stopReason: "max_tokens",
        outputTokens: 1500,
      },
    ]);
    const out = await generateSection({ pack, client, model: "m" });
    expect(out.status).toBe("fallback");
    expect(out.attempts).toBe(1);
    expect(client.requests).toHaveLength(1);
    expect(out.truncatedAtTokens).toBe(1500);
    expect(out.problems).toEqual([
      "reply truncated at 1500 output tokens (cap 1500); not retried",
    ]);
  });

  it("D-040: steps and how-we-do-this sections get a 4,000 cap, others 1,500; the cap is not part of the fixture key", () => {
    const stepsSection = sectionsFor(type).find(
      (s) => s.id === "how-we-do-this",
    )!;
    const stepsPack = buildContextPack({
      answers: reference.answers,
      result: reference.result,
      dataset,
      type,
      section: stepsSection,
    });
    expect(buildModelRequest(stepsPack, "m").maxTokens).toBe(4000);
    expect(buildModelRequest(pack, "m").maxTokens).toBe(1500);
    // D-043: the policy statement carries a commitment per quality indicator, so it gets 2,500.
    const statementSection = sectionsFor(type).find(
      (s) => s.id === "policy-statement",
    )!;
    const statementPack = buildContextPack({
      answers: reference.answers,
      result: reference.result,
      dataset,
      type,
      section: statementSection,
    });
    expect(buildModelRequest(statementPack, "m").maxTokens).toBe(2500);
    expect(requestHash(buildModelRequest(pack, "m", 2000))).toBe(
      requestHash(buildModelRequest(pack, "m", 1500)),
    );
  });
  it("R-7: a restated timeframe is a validation problem that names the fixed section", async () => {
    const incident = documentTypeById(
      "incident-management-policy-and-register",
    )!;
    const howWe = sectionsFor(incident).find((s) => s.id === "how-we-do-this")!;
    const incidentPack = buildContextPack({
      answers: reference.answers,
      result: reference.result,
      dataset,
      type: incident,
      section: howWe,
    });
    expect(incidentPack.rulesSection).toEqual({
      id: "reportable-incidents",
      number: "7",
      heading: "Reportable incidents",
    });
    const restating = JSON.stringify({
      sectionId: "how-we-do-this",
      usedFacts: ["tradingName"],
      blocks: [
        {
          type: "steps",
          items: [
            "We tell the Commission within 24 hours.",
            "We record it the same day.",
          ],
        },
      ],
    });
    const fixed = JSON.stringify({
      sectionId: "how-we-do-this",
      usedFacts: ["tradingName"],
      blocks: [
        {
          type: "steps",
          items: [
            "We tell the Commission in the time set out in section 7 Reportable incidents.",
            "We record it the same day.",
          ],
        },
      ],
    });
    const client = new FakeClient([restating, fixed]);
    const out = await generateSection({
      pack: incidentPack,
      client,
      model: "m",
      allowedPhrases: classNames,
    });
    expect(out.status).toBe("generated");
    expect(out.attempts).toBe(2);
    expect(out.problems[0]).toBe(
      'restates a statutory timeframe ("within 24 hours"): refer to section 7 Reportable incidents instead of restating the timeframe',
    );
    expect(client.requests[1].user).toContain(
      "refer to section 7 Reportable incidents",
    );
    // A document without a rules section gets the generic instruction.
    const generic = await generateSection({
      pack,
      client: new FakeClient([
        GOOD.replace(
          "It names who makes each decision.",
          "We report within 5 business days.",
        ),
        GOOD,
      ]),
      model: "m",
    });
    expect(generic.problems[0]).toMatch(
      /refer to the fixed section that holds the rule/,
    );
  });
  it("R-8: the pack carries the review cycles, the brief states them, and a wrong cycle retries with the instruction", async () => {
    const incident = documentTypeById(
      "incident-management-policy-and-register",
    )!;
    const howWe = sectionsFor(incident).find((s) => s.id === "how-we-do-this")!;
    const incidentPack = buildContextPack({
      answers: reference.answers,
      result: reference.result,
      dataset,
      type: incident,
      section: howWe,
    });
    expect(incidentPack.reviewCycles).toEqual({
      policyMonths: 12,
      registerMonths: 3,
    });
    expect(incidentPack.section.brief).toContain(
      "policy review every 12 months; register review every 3 months",
    );
    expect(buildModelRequest(incidentPack, "m").user).toContain(
      "register review every 3 months",
    );
    const wrong = JSON.stringify({
      sectionId: "how-we-do-this",
      usedFacts: ["tradingName"],
      blocks: [
        {
          type: "steps",
          items: ["We review the incident register every 12 months."],
        },
      ],
    });
    const right = JSON.stringify({
      sectionId: "how-we-do-this",
      usedFacts: ["tradingName"],
      blocks: [
        {
          type: "steps",
          items: ["We review the incident register every 3 months."],
        },
      ],
    });
    const client = new FakeClient([wrong, right]);
    const out = await generateSection({
      pack: incidentPack,
      client,
      model: "m",
      allowedPhrases: classNames,
    });
    expect(out.status).toBe("generated");
    expect(out.attempts).toBe(2);
    expect(out.problems[0]).toMatch(
      /^states a review cycle \("every 12 months"\): use the review cycles given: policy review every 12 months, register review every 3 months/,
    );
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
