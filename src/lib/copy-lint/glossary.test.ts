// @vitest-environment node
/**
 * REQ-027 FR-2's matcher (D-2705, D-2710, D-2714, D-2724): the accepted
 * forms per term as data, the phrase exclusions, the whole-word rule, the
 * bracket stripping for the term pass and the token list.
 */
import { describe, expect, it } from "vitest";
import {
  glossaryBracket,
  glossaryContent,
  glossaryTerm,
} from "@/lib/questionnaire/content";
import {
  GLOSSARY_FORMS,
  findGlossaryTerms,
  glossaryTokens,
  hasMeaning,
  stripGlossaryBrackets,
  withoutExclusions,
} from "./glossary";

describe("the glossary term match (REQ-027 FR-2)", () => {
  it("names every glossary id once, and every form is lower-case data", () => {
    expect(GLOSSARY_FORMS.map((g) => g.id).sort()).toEqual(
      glossaryContent.items.map((t) => t.id).sort(),
    );
    for (const g of GLOSSARY_FORMS)
      for (const f of [...g.forms, ...(g.exclusions ?? [])])
        expect(f, g.id).toBe(f.toLowerCase());
  });

  it("matches a noun and its plural, capitalised or not, and the verb forms of adopt (finding 3)", () => {
    expect(findGlossaryTerms("The Modules that apply.")).toEqual(["module"]);
    expect(findGlossaryTerms("Two registration groups, one module.")).toEqual([
      "registration-group",
      "module",
    ]);
    expect(
      findGlossaryTerms("Quality indicators and a Practice Standard."),
    ).toEqual(["quality-indicator", "practice-standards"]);
    for (const verb of ["adopt", "adopts", "adopted", "adopting"])
      expect(findGlossaryTerms(`You ${verb} it.`), verb).toEqual(["adopt"]);
  });

  it("does not match standards alone, modular, class or worker screening alone", () => {
    expect(findGlossaryTerms("The standards are high.")).toEqual([]);
    expect(findGlossaryTerms("A modular kitchen.")).toEqual([]);
    expect(findGlossaryTerms("Each class of supports.")).toEqual([]);
    expect(findGlossaryTerms("Worker screening matters.")).toEqual([]);
    expect(findGlossaryTerms("The adoption of a plan.")).toEqual([]);
  });

  it("the clearance's four forms are the worker screening check, in any case (decision 4; findings 117 and 169)", () => {
    expect(
      findGlossaryTerms("hold a current NDIS Worker Screening clearance?"),
    ).toEqual(["worker-screening-check"]);
    expect(findGlossaryTerms("Worker screening clearance register")).toEqual([
      "worker-screening-check",
    ]);
    expect(
      findGlossaryTerms("Their worker screening clearances lapsed."),
    ).toEqual(["worker-screening-check"]);
    expect(findGlossaryTerms("an NDIS Worker Screening Check")).toEqual([
      "worker-screening-check",
    ]);
  });

  it("the orientation module is a course, not a module, in any case (decision 3; findings 116 and 155)", () => {
    expect(
      findGlossaryTerms("the NDIS worker orientation module and training"),
    ).toEqual([]);
    expect(findGlossaryTerms("NDIS Worker Orientation Module")).toEqual([]);
    expect(findGlossaryTerms("the Commission's orientation module")).toEqual(
      [],
    );
    expect(withoutExclusions("one Orientation Module and one module")).toMatch(
      /module$/,
    );
    expect(
      findGlossaryTerms("the orientation module and the core module"),
    ).toEqual(["module"]);
  });

  it("skips the ids in the VERIFY list (D-2705) and keeps first-appearance order", () => {
    expect(
      findGlossaryTerms("A mid-term audit checks each module.", {
        skip: ["module"],
      }),
    ).toEqual(["mid-term-audit"]);
    expect(
      findGlossaryTerms("Adopt it after the certification audit."),
    ).toEqual(["adopt", "certification-audit"]);
  });

  it("strips a bracket's rendered text for the term pass, and the meaning is still found in the full text (D-2714, D-2724)", () => {
    const page = `Each ${glossaryBracket("module")} is listed. A module can be long.`;
    // The strip takes the whole bracket out, so a meaning that named another term would pull none in
    // (D-2714). Since D-2852 no meaning names another term, so the full text finds one term too.
    const stripped = stripGlossaryBrackets(page);
    expect(stripped).not.toContain(glossaryTerm("module").meaning);
    expect(findGlossaryTerms(stripped)).toEqual(["module"]);
    expect(findGlossaryTerms(page)).toEqual(["module"]);
    expect(hasMeaning(page, "module")).toBe(true);
    expect(hasMeaning("Each module is listed.", "module")).toBe(false);
  });

  it("lists the tokens in a text, in order (D-2715)", () => {
    expect(
      glossaryTokens(
        "A {{glossary:mid-term-audit}} and an {{glossary:adopt}}.",
      ),
    ).toEqual(["mid-term-audit", "adopt"]);
    expect(glossaryTokens("No token here.")).toEqual([]);
  });
});
