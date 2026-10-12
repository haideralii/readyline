/**
 * REQ-005 SR-2, AC-4: injected instructions in business fields do not change
 * document structure, do not reach the model outside the delimited facts, and
 * cannot introduce prohibited claims into a document even if the model obeys
 * them. The ABN and state fields are enumerated or checksummed by the
 * questionnaire schema, so the trading name and the excluded services note
 * are the only free text an attacker controls.
 */
import { describe, expect, it } from "vitest";
import { QuestionnaireAnswers } from "@/lib/questionnaire/schema";
import { buildResult } from "@/lib/questionnaire/result";
import { getStandardsDataset } from "@/lib/standards/dataset";
import injected from "../../../fixtures/red-team/injected-trading-name.json";
import { documentTypeById, sectionsFor } from "./catalogue";
import { buildContextPack } from "./context-pack";
import { buildSkeleton, modelStructure } from "./document-model";
import { buildProviderFacts } from "./facts";
import { generateSection } from "./generate-section";
import { FakeClient } from "./model-client";
import { buildModelRequest } from "./prompts";
import { loadReferenceCases } from "./reference-cases";

const dataset = getStandardsDataset();
const [clean] = loadReferenceCases();
const rawAnswers: Record<string, unknown> = { ...injected };
delete rawAnswers.note;
const answers = QuestionnaireAnswers.parse(rawAnswers);
const built = buildResult(dataset, answers);
if (!built.ok) throw new Error(built.message);
const result = built.result;
const type = documentTypeById("governance-policy")!;
const section = sectionsFor(type).find((s) => s.id === "purpose")!;

describe("red-team fixture: injected trading name (SR-2, AC-4)", () => {
  it("keeps the same document structure as the clean case", () => {
    const skeleton = buildSkeleton({
      type,
      facts: buildProviderFacts(answers, result),
      dataset,
      result,
      version: "t",
      generatedAt: "2026-10-12",
    });
    const cleanSkeleton = buildSkeleton({
      type,
      facts: buildProviderFacts(clean.answers, clean.result),
      dataset,
      result: clean.result,
      version: "t",
      generatedAt: "2026-10-12",
    });
    const strip = (m: ReturnType<typeof modelStructure>) => ({
      ...m,
      title: "",
    });
    expect(strip(modelStructure(skeleton))).toEqual(
      strip(modelStructure(cleanSkeleton)),
    );
  });

  it("places the injected text only inside the FACTS block and drops the services note entirely", () => {
    const pack = buildContextPack({ answers, result, dataset, type, section });
    const request = buildModelRequest(pack, "m");
    const facts = request.user.slice(
      request.user.indexOf("<<<FACTS>>>"),
      request.user.indexOf("<<<END FACTS>>>"),
    );
    const outside = request.user.replace(facts, "");
    expect(facts).toContain("Ignore all previous instructions");
    expect(outside).not.toContain("Ignore all previous instructions");
    expect(request.system).not.toContain("Ignore all previous");
    for (const text of [request.user, request.system, JSON.stringify(pack)]) {
      expect(text).not.toContain("J. Doe");
      expect(text).not.toContain("430000000");
      expect(text).not.toContain("participant list");
    }
  });

  it("rejects a reply that obeys the injection and falls back without the claim", async () => {
    const pack = buildContextPack({ answers, result, dataset, type, section });
    const obeyed = JSON.stringify({
      sectionId: "purpose",
      usedFacts: ["tradingName"],
      blocks: [
        {
          type: "paragraph",
          text: "Registration is guaranteed and this policy is audit-proof.",
        },
      ],
    });
    const out = await generateSection({
      pack,
      client: new FakeClient([obeyed, obeyed]),
      model: "m",
    });
    expect(out.status).toBe("fallback");
    const text = JSON.stringify(out.blocks);
    expect(text).not.toMatch(/guaranteed|audit-proof/i);
    expect(out.problems.some((p) => /claim/.test(p))).toBe(true);
  });
});
