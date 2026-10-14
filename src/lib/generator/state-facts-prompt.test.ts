// @vitest-environment node
/**
 * NDIS watch 13 October 2026 item A1 (batch 35, D-1801) and the brief
 * additions (D-1802): the state-tailored sections' prompts carry the STATE
 * FACTS block for the provider's states and nothing else about states; every
 * other section's prompt is unchanged in shape; the governance and
 * conflict-of-interest policy statements carry their document-specific
 * sentences. Built from the reference cases, no model call.
 */
import { describe, expect, it } from "vitest";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { documentTypeById, sectionsFor } from "./catalogue";
import { buildContextPack } from "./context-pack";
import { buildUserPrompt } from "./prompts";
import { loadReferenceCases } from "./reference-cases";
import { STATE_FACT_SECTIONS } from "./state-facts";

const dataset = getStandardsDataset();
const cases = loadReferenceCases();

function promptFor(caseId: string, typeId: string, sectionId: string) {
  const c = cases.find((x) => x.id === caseId)!;
  const type = documentTypeById(typeId)!;
  const section = sectionsFor(type).find((s) => s.id === sectionId)!;
  const pack = buildContextPack({
    answers: c.answers,
    result: c.result,
    dataset,
    type,
    section,
  });
  return { pack, user: buildUserPrompt(pack) };
}

describe("STATE FACTS block (A1, D-1801)", () => {
  it("names the four consumer sections", () => {
    expect([...STATE_FACT_SECTIONS].sort()).toEqual([
      "retention-schedule",
      "state-authorisation",
      "state-reporting",
      "training-matrix",
    ]);
  });

  it("the behaviour-support case's state authorisation section sees its states' facts with sources, and the brief points at the block", () => {
    const { pack, user } = promptFor(
      "behaviour-support-company",
      "restrictive-practice-authorisation-and-reporting-procedure",
      "state-authorisation",
    );
    expect(pack.stateFacts?.map((s) => s.code)).toEqual(
      pack.facts.states.map((name) =>
        name === "New South Wales"
          ? "NSW"
          : name === "Victoria"
            ? "VIC"
            : name === "Queensland"
              ? "QLD"
              : name,
      ),
    );
    expect(user).toContain("<<<STATE FACTS>>>");
    expect(user).toContain("<<<END STATE FACTS>>>");
    expect(user).toMatch(
      /Restrictive practice authorisation: .* \(source: .*read 2026-10-13; (verified|unverified)\)/,
    );
    expect(user).toContain("write the blank [state]");
    expect(pack.section.brief).toContain("Use only the STATE FACTS block");
    // The block sits in the section block, after the brief and before the reply instruction.
    const brief = user.indexOf("Section brief:");
    const block = user.indexOf("<<<STATE FACTS>>>");
    const reply = user.indexOf("Reply with the JSON object only.");
    expect(brief).toBeLessThan(block);
    expect(block).toBeLessThan(reply);
  });

  it("the sole trader's retention schedule and training matrix carry the block for New South Wales only; the scope section does not", () => {
    for (const [typeId, sectionId] of [
      ["records-management-policy", "retention-schedule"],
      ["induction-and-training-procedure-and-register", "training-matrix"],
    ] as const) {
      const { pack, user } = promptFor(
        "verification-sole-trader",
        typeId,
        sectionId,
      );
      expect(pack.stateFacts?.map((s) => s.code)).toEqual(["NSW"]);
      expect(user).toContain("New South Wales (NSW):");
      expect(user).not.toContain("Victoria (VIC):");
    }
    const scope = promptFor(
      "verification-sole-trader",
      "governance-policy",
      "scope",
    );
    expect(scope.pack.stateFacts).toBeUndefined();
    expect(scope.user).not.toContain("STATE FACTS");
  });
});

describe("brief additions (D-1802)", () => {
  it("the governance policy statement asks for the s 13A commitment and the conflict-of-interest statement for the inducement rule; other policies' statements are unchanged", () => {
    const governance = promptFor(
      "verification-sole-trader",
      "governance-policy",
      "policy-statement",
    );
    expect(governance.pack.section.brief).toContain(
      "We tell the Commission about changes and events in its approved form as soon as we know they will happen.",
    );
    const conflict = promptFor(
      "verification-sole-trader",
      "conflict-of-interest-policy",
      "policy-statement",
    );
    expect(conflict.pack.section.brief).toContain(
      "We do not offer or accept any payment, gift or benefit to attract or keep a participant, or in return for a referral.",
    );
    const privacy = promptFor(
      "verification-sole-trader",
      "privacy-and-information-management-policy",
      "policy-statement",
    );
    expect(privacy.pack.section.brief).not.toContain("approved form");
    expect(privacy.pack.section.brief).not.toContain("referral");
    const complaints = promptFor(
      "verification-sole-trader",
      "complaints-management-policy-and-register",
      "procedure",
    );
    expect(complaints.pack.section.brief).toContain(
      "if the Commission requires us to take actions on a complaint",
    );
  });
});
