/**
 * Replay harness and pipeline (REQ-005 D-502, AC-5): fixtures round-trip
 * through a temp directory, a missing fixture fails with its key, and the
 * validate-retry-fallback path behaves as the REQ describes. No network.
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
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
  AnthropicClient,
  createModelClient,
  FakeClient,
  MissingFixtureError,
  RecordingClient,
  ReplayClient,
  type CreateMessage,
  type Fixture,
} from "./model-client";
import { buildModelRequest, requestHash } from "./prompts";
import { readability } from "@/lib/text/readability";
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

  it("D-530: the Anthropic client switches thinking off and the fixture keeps the content block types", async () => {
    const seen: Parameters<CreateMessage>[0][] = [];
    const create: CreateMessage = async (params) => {
      seen.push(params);
      return {
        id: "msg_test",
        type: "message",
        role: "assistant",
        model: params.model,
        content: [
          { type: "thinking", thinking: "...", signature: "" },
          { type: "text", text: GOOD, citations: null },
        ],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          cache_creation_input_tokens: null,
          cache_read_input_tokens: null,
          cache_creation: null,
          server_tool_use: null,
          service_tier: null,
          inference_geo: null,
        },
      } as unknown as Awaited<ReturnType<CreateMessage>>;
    };
    const dir = mkdtempSync(join(tmpdir(), "readyline-anthropic-"));
    const request = buildModelRequest(pack, "m");
    const recording = new RecordingClient(
      new AnthropicClient("test-key", create),
      dir,
    );
    const reply = await recording.complete(request, labels);
    expect(seen).toHaveLength(1);
    expect(seen[0].thinking).toEqual({ type: "between_tools" });
    expect(seen[0].max_tokens).toBe(request.maxTokens);
    expect(reply.text).toBe(GOOD);
    expect(reply.contentTypes).toEqual(["thinking", "text"]);
    const fixture = JSON.parse(
      readFileSync(
        join(dir, type.id, section.id, `${requestHash(request)}.json`),
        "utf8",
      ),
    ) as Fixture;
    expect(fixture.thinking).toBe("between_tools");
    expect(fixture.contentTypes).toEqual(["thinking", "text"]);
    rmSync(dir, { recursive: true, force: true });
  });

  it("D-047: short sections warn but never fail on readability; the fail line is the document's", () => {
    const hard =
      "Organisational governance arrangements continuously demonstrate accountability and transparency.";
    const reply = (sentences: number) =>
      JSON.stringify({
        sectionId: "purpose",
        usedFacts: ["tradingName"],
        blocks: [
          { type: "paragraph", text: Array(sentences).fill(hard).join(" ") },
        ],
      });
    // Two sentences (16 words): far above 11, but too short a sample to fail.
    const short = validateReply(reply(2), pack, []);
    expect(short.ok).toBe(true);
    if (short.ok) expect(short.readability.level).toBe("fail");
    // Six sentences (48 words) at the same grade fail at 11.
    const long = validateReply(reply(6), pack, []);
    expect(long.ok).toBe(false);
    if (!long.ok) expect(long.problems[0]).toMatch(/is above 11:/);
    // The privacy policy's line is 12 (D-047); a grade between 11 and 12 passes there only.
    const privacy = documentTypeById(
      "privacy-and-information-management-policy",
    )!;
    const privacyPack = buildContextPack({
      answers: reference.answers,
      result: reference.result,
      dataset,
      type: privacy,
      section: sectionsFor(privacy).find((s) => s.id === "scope")!,
    });
    expect(privacyPack.readabilityGate).toEqual({
      failAbove: 12,
      shortSectionWords: 40,
    });
    expect(pack.readabilityGate).toEqual({
      failAbove: 11,
      shortSectionWords: 40,
    });
    const between =
      "We keep participant information secure, share it only with consent, and destroy it when the retention period ends. ";
    const text = Array(5).fill(between).join("").trim();
    const grade = readability(text).grade;
    expect(grade).toBeGreaterThan(11);
    expect(grade).toBeLessThanOrEqual(12);
    const body = JSON.stringify({
      sectionId: "scope",
      usedFacts: ["tradingName"],
      blocks: [{ type: "paragraph", text }],
    });
    expect(validateReply(body, privacyPack, []).ok).toBe(true);
    expect(
      validateReply(body.replace('"scope"', '"purpose"'), pack, []).ok,
    ).toBe(false);
  });

  it("R-12: a document kept on an obligation gets briefs that name it, and a placeholder asking for a standard is retried", async () => {
    // The governance policy cites only core standards, which the verification case is not audited against.
    expect(pack.document.basisReason).toBe(
      "the NDIS Code of Conduct applies to every provider and worker",
    );
    expect(pack.section.brief).toContain(
      "which obligation it supports: the NDIS Code of Conduct applies to every provider and worker",
    );
    expect(pack.section.brief).toMatch(
      /Never name or ask for a Practice Standard/,
    );
    const statement = sectionsFor(type).find(
      (s) => s.id === "policy-statement",
    )!;
    const statementPack = buildContextPack({
      answers: reference.answers,
      result: reference.result,
      dataset,
      type,
      section: statement,
    });
    expect(statementPack.section.brief).toContain(
      '"Our commitment" and "What we do"',
    );
    expect(statementPack.section.brief).not.toMatch(
      /quality indicators listed/,
    );
    // The incident policy has a verification standard: briefs and basis untouched.
    const incident = documentTypeById(
      "incident-management-policy-and-register",
    )!;
    const incidentPack = buildContextPack({
      answers: reference.answers,
      result: reference.result,
      dataset,
      type: incident,
      section: sectionsFor(incident).find((s) => s.id === "purpose")!,
    });
    expect(incidentPack.document.basisReason).toBeNull();
    expect(incidentPack.section.brief).toMatch(/which standard it supports/);
    // A placeholder that asks for a standard is a validation problem naming the obligation.
    const asking = JSON.stringify({
      sectionId: "purpose",
      usedFacts: ["tradingName"],
      blocks: [
        {
          type: "paragraph",
          text: "This policy sets out how we run the business.",
        },
        {
          type: "callout",
          text: "[Provider to complete: name the NDIS Practice Standard this policy supports.]",
        },
      ],
    });
    const client = new FakeClient([asking, GOOD]);
    const out = await generateSection({ pack, client, model: "m" });
    expect(out.status).toBe("generated");
    expect(out.attempts).toBe(2);
    expect(out.problems[0]).toMatch(
      /asks the provider for a standard .*this document rests on this obligation: the NDIS Code of Conduct applies to every provider and worker; never ask the provider to name a Practice Standard or quality indicator/,
    );
  });

  it("D-046: a model that refuses the thinking parameter gets 'disabled', then no parameter, once each", async () => {
    const seen: Parameters<CreateMessage>[0][] = [];
    const create: CreateMessage = async (params) => {
      seen.push(params);
      if ("thinking" in params)
        throw Object.assign(
          new Error(
            '400 {"type":"error","error":{"message":"\\"thinking\\" is not supported on this model"}}',
          ),
          { status: 400 },
        );
      return {
        id: "msg_test",
        type: "message",
        role: "assistant",
        model: params.model,
        content: [{ type: "text", text: GOOD, citations: null }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          cache_creation_input_tokens: 3,
          cache_read_input_tokens: 4,
        },
      } as unknown as Awaited<ReturnType<CreateMessage>>;
    };
    const reply = await new AnthropicClient("test-key", create).complete(
      buildModelRequest(pack, "claude-haiku-5-5"),
    );
    expect(seen).toHaveLength(3);
    expect(seen[0].thinking).toEqual({ type: "between_tools" });
    expect(seen[1].thinking).toEqual({ type: "disabled" });
    expect("thinking" in seen[2]).toBe(false);
    expect(seen[2].system).toEqual(seen[0].system);
    expect(reply.thinking).toBe("none");
    expect(reply.usage).toEqual({
      inputTokens: 10,
      outputTokens: 20,
      cacheCreationInputTokens: 3,
      cacheReadInputTokens: 4,
    });
    // Any other error is not retried.
    const failing: CreateMessage = async () => {
      throw Object.assign(new Error("500 overloaded"), { status: 500 });
    };
    await expect(
      new AnthropicClient("test-key", failing).complete(
        buildModelRequest(pack, "m"),
      ),
    ).rejects.toThrow(/overloaded/);
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
          // Two sentences so the section is over the D-047 short-section line (40 words) and can fail.
          text: "Notwithstanding the aforementioned organisational considerations, the comprehensive implementation of multidisciplinary governance arrangements necessitates the systematic utilisation of standardised documentation methodologies across all operational jurisdictions. Furthermore, the aforementioned organisational considerations necessitate the comprehensive implementation of standardised documentation methodologies across all multidisciplinary governance arrangements.",
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

  it("R-9: a cross-reference outside the outline is a validation problem that names the right section", async () => {
    const complaints = documentTypeById(
      "complaints-management-policy-and-register",
    )!;
    const responsibilities = sectionsFor(complaints).find(
      (s) => s.id === "responsibilities",
    )!;
    const complaintsPack = buildContextPack({
      answers: reference.answers,
      result: reference.result,
      dataset,
      type: complaints,
      section: responsibilities,
    });
    const row = (when: string) =>
      JSON.stringify({
        sectionId: "responsibilities",
        usedFacts: ["tradingName"],
        blocks: [
          {
            type: "table",
            columns: ["Role", "Does what", "When"],
            rows: [["Owner", "Acknowledges each complaint.", when]],
          },
        ],
      });
    const client = new FakeClient([
      row("Timeframes are in section 3 What we do."),
      row("Timeframes are in section 7 Complaints procedure."),
    ]);
    const out = await generateSection({
      pack: complaintsPack,
      client,
      model: "m",
    });
    expect(out.status).toBe("generated");
    expect(out.attempts).toBe(2);
    expect(out.problems[0]).toMatch(
      /cross-reference "section 3 What we do" does not match the outline: section 3 is Definitions, and no section is called What we do/,
    );
    expect(client.requests[1].user).toMatch(
      /Refer to sections by the number and title in the outline \(1 Purpose, 2 Scope, 3 Definitions/,
    );
  });
});
