// @vitest-environment node
/**
 * REQ-033 Session B: the e2e's fake model answers a redraft request from the
 * request itself and nothing else; the client that carries it is chosen by
 * GENERATION_FAKE=1 alone and leaves every other request to the replay.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { documentTypeById } from "./catalogue";
import type { DocumentModel } from "./document-model";
import { FAKE_REDRAFT_SENTENCE, fakeRedraftReply } from "./fake-redraft";
import { createModelClient, MissingFixtureError } from "./model-client";
import {
  buildRedraftRequest,
  readRedraftReply,
  redraftChecks,
} from "./redraft";
import { getStandardsDataset } from "@/lib/standards/dataset";

const model = JSON.parse(
  readFileSync("data/samples/complaints-policy.json", "utf8"),
) as DocumentModel;
const type = documentTypeById(model.typeId)!;
const request = buildRedraftRequest({
  type,
  model,
  sectionId: "scope",
  standard: {
    name: "Feedback and complaints management",
    outcome: "x",
    indicators: ["y"],
  },
  finding: "The scope does not say who may complain for a participant.",
  modelId: "m",
});

describe("fakeRedraftReply", () => {
  it("echoes the current section's lines as paragraphs and adds one plain sentence that passes the checks", () => {
    const text = fakeRedraftReply(request)!;
    const parsed = JSON.parse(text) as {
      sectionId: string;
      blocks: { type: string; text: string }[];
    };
    expect(parsed.sectionId).toBe("scope");
    expect(parsed.blocks.at(-1)!.text).toBe(FAKE_REDRAFT_SENTENCE);
    const current = model.sections.find((s) => s.id === "scope")!.blocks;
    const reading = readRedraftReply({
      text,
      sectionId: "scope",
      current,
      finding: "The scope does not say who may complain for a participant.",
      tradingName: model.facts.tradingName,
      allowedPhrases: getStandardsDataset().registrationGroups.map(
        (g) => g.name,
      ),
      readabilityGate: { failAbove: 12, shortSectionWords: 40 },
    });
    expect(reading.ok, JSON.stringify(reading)).toBe(true);
    expect(
      redraftChecks({
        current,
        proposed: parsed.blocks as never,
        finding: "x",
        tradingName: model.facts.tradingName,
      }),
    ).toEqual([]);
  });

  it("answers null for a request that is not a redraft", () => {
    expect(
      fakeRedraftReply({ ...request, user: "Write the section purpose." }),
    ).toBeNull();
  });
});

describe("createModelClient with GENERATION_FAKE", () => {
  it("answers a redraft from the request and leaves other requests to the replay client", async () => {
    const client = createModelClient({ GENERATION_FAKE: "1" });
    expect(client.mode).toBe("fake");
    const reply = await client.complete(request, {
      documentTypeId: type.id,
      sectionId: "redraft-scope",
    });
    expect(reply.text).toContain(FAKE_REDRAFT_SENTENCE);
    await expect(
      client.complete(
        {
          ...request,
          user: "Write the section purpose.",
          promptVersion: "none",
        },
        { documentTypeId: type.id, sectionId: "purpose" },
      ),
    ).rejects.toBeInstanceOf(MissingFixtureError);
  });

  it("is never chosen in production, and never without the flag", () => {
    expect(
      createModelClient({ GENERATION_FAKE: "1", VERCEL_ENV: "production" })
        .mode,
    ).toBe("replay");
    expect(createModelClient({}).mode).toBe("replay");
  });
});
