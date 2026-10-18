// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { collectBlanks } from "./blanks";
import { documentTypeById } from "./catalogue";
import { buildSkeleton } from "./document-model";
import { buildProviderFacts } from "./facts";
import {
  applyFacts,
  factKeyFor,
  fillText,
  formBlanks,
  formFactKeyFor,
  formQuestionsFor,
  isAccountFactKey,
  questionsFor,
  remainingBlanks,
  applyLiveFacts,
  detailsQuestionsFor,
  isFactValueAllowed,
  liveFacts,
  openFormBlanks,
} from "./facts-fill";
import { loadReferenceCases } from "./reference-cases";

const dataset = getStandardsDataset();
const c = loadReferenceCases()[0];
const facts = buildProviderFacts(c.answers, c.result);
const governance = buildSkeleton({
  type: documentTypeById("governance-policy")!,
  facts,
  dataset,
  result: c.result,
  version: "1",
  generatedAt: "2026-10-14",
});

describe("account facts stay off the Finish form (D-541 as amended, batch 37)", () => {
  it("the owner's name, role and the approval date are account facts; the form asks for everything else", () => {
    for (const key of ["name", "role", "owner-role", "date"])
      expect(isAccountFactKey(key), key).toBe(true);
    expect(isAccountFactKey("phone-or-email")).toBe(false);
    const blanks = collectBlanks(governance);
    const all = questionsFor(blanks).map((q) => q.key);
    expect(all).toContain("name");
    expect(all).toContain("date");
    const form = formQuestionsFor(blanks).map((q) => q.key);
    expect(form).not.toContain("name");
    expect(form).not.toContain("role");
    expect(form).not.toContain("date");
    expect(form).toEqual(all.filter((k) => !isAccountFactKey(k)));
  });

  it("one rule counts the blanks the form can ask for: the strip and the set page count what the form asks (run 38599190033)", () => {
    expect(formFactKeyFor("[Date]")).toBeNull();
    expect(formFactKeyFor("[name]")).toBeNull();
    expect(formFactKeyFor("[owner role]")).toBeNull();
    expect(formFactKeyFor("[phone or email]")).toBe("phone-or-email");
    expect(formFactKeyFor("[Signature]")).toBeNull();
    const blanks = collectBlanks(governance);
    expect(
      new Set(formBlanks(blanks).map((b) => formFactKeyFor(b.blank))),
    ).toEqual(new Set(formQuestionsFor(blanks).map((q) => q.key)));
    // A set whose only open blanks are account facts (the skeleton's fixed
    // approver, approval date and change-log author) has nothing left for
    // the form, so the strip must not hold the step at finish.
    const accountOnly = blanks.filter((b) =>
      ["name", "role", "owner-role", "date"].includes(
        factKeyFor(b.blank) ?? "",
      ),
    );
    expect(accountOnly.length).toBeGreaterThan(0);
    expect(formBlanks(accountOnly)).toEqual([]);
    // One form blank among them is the one the count sees.
    const withPhone = [
      ...accountOnly,
      { ...accountOnly[0], blank: "[phone or email]" },
    ];
    expect(formBlanks(withPhone).map((b) => b.blank)).toEqual([
      "[phone or email]",
    ]);
  });

  it("the fill primitive still fills the three fixed blanks when given name, role and date (the adoption fill uses it, D-2855)", () => {
    const filled = applyFacts(governance, {
      name: "Jane Citizen",
      role: "Owner",
      date: "14 October 2026",
    });
    const control = filled.sections.find((s) => s.id === "document-control")!;
    const rows = control.blocks.flatMap((b) =>
      b.type === "table" ? b.rows : [],
    );
    expect(rows).toContainEqual(["Approver", "Jane Citizen, Owner"]);
    expect(rows).toContainEqual(["Approval date", "14 October 2026"]);
    const log = filled.sections.find((s) => s.id === "change-log")!;
    const logRows = log.blocks.flatMap((b) =>
      b.type === "table" ? b.rows : [],
    );
    expect(logRows[0]?.at(-1)).toBe("Jane Citizen");
    expect(
      collectBlanks(filled).filter((b) =>
        ["[name]", "[role]", "[date]"].includes(b.blank),
      ),
    ).toEqual([]);
  });
});

describe("facts-fill (REQ-017 FR-2, D-1702)", () => {
  it("keys the known blanks, asks unknown ones by their text, and leaves signatures and register rows alone", () => {
    expect(factKeyFor("[name]")).toBe("name");
    expect(factKeyFor("[phone or email]")).toBe("phone-or-email");
    expect(factKeyFor("[Date]")).toBe("date");
    expect(factKeyFor("[Signature]")).toBeNull();
    expect(factKeyFor("[Easy Read version]")).toBeNull();
    expect(factKeyFor("[C-001]")).toBeNull();
    expect(factKeyFor("[Yes / No]")).toBeNull();
    expect(factKeyFor("[Not started / In progress / Met]")).toBeNull();
    expect(factKeyFor("[key contact at the clinic]")).toBe(
      "key-contact-at-the-clinic",
    );
  });

  it("asks once per fact across a set, in reading order, with an example", () => {
    const blanks = [...collectBlanks(governance), ...collectBlanks(governance)];
    const qs = questionsFor(blanks);
    const keys = qs.map((q) => q.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("name");
    expect(keys).toContain("role");
    expect(keys).toContain("date");
    for (const q of qs) {
      expect(q.question).toMatch(/\?$/);
      expect(q.example.length).toBeGreaterThan(5);
    }
  });

  it("fills every known blank in text, bullets and tables and keeps the rest", () => {
    expect(
      fillText(
        "Approved by [name], [role], on [date]. Sign here: [Signature].",
        {
          name: "Jane Citizen",
          role: "Owner",
        },
      ),
    ).toBe(
      "Approved by Jane Citizen, Owner, on [date]. Sign here: [Signature].",
    );
    const filled = applyFacts(governance, {
      name: "Jane Citizen",
      role: "Owner",
      date: "14 October 2026",
    });
    const text = JSON.stringify(filled);
    expect(text).toContain("Jane Citizen, Owner");
    expect(text).not.toMatch(/\[name\]|\[role\]|\[date\]/);
    expect(remainingBlanks(governance, {}).length).toBeGreaterThan(0);
    expect(
      remainingBlanks(governance, {
        name: "Jane Citizen",
        role: "Owner",
        date: "14 October 2026",
      }),
    ).toEqual([]);
  });

  it("never changes a model when there are no facts", () => {
    expect(applyFacts(governance, {})).toBe(governance);
  });
});

describe("REQ-029: the live fill, the participant rule and the fact-aware count (FR-3, FR-7, FR-10; D-2855)", () => {
  const facts = {
    name: "Jane Citizen",
    role: "Owner",
    date: "14 October 2026",
    "phone-or-email": "0400 000 000",
    "other-tool": "Deputy",
    "allowed-use": "Rostering",
    limits: "Participant notes",
    period: "7 years",
  };

  it("the live facts are every saved fact but the approver's name and role and the date", () => {
    expect(Object.keys(liveFacts(facts)).sort()).toEqual([
      "allowed-use",
      "limits",
      "other-tool",
      "period",
      "phone-or-email",
    ]);
    expect(liveFacts({ name: "x", "phone-or-email": "  " })).toEqual({});
  });

  it("the live fill leaves the Approver row, the date and the change-log author bracketed and fills the contact and appendix blanks", () => {
    const live = applyLiveFacts(governance, facts);
    const text = JSON.stringify(live);
    expect(text).toContain("[name], [role]");
    expect(text).toContain("[date]");
    expect(text).not.toContain("Jane Citizen");
    expect(text).not.toContain("[phone or email]");
    const kept = collectBlanks(live).map((b) => b.blank);
    expect(kept).toContain("[name]");
    expect(kept).not.toContain("[phone or email]");
  });

  it("FR-7: a [name] in the same sentence as [participant reference] is never the owner's; one in another sentence is", () => {
    const agreement =
      "This agreement is between Sunrise Supports (the provider) and [participant reference] (the participant), or their representative [name]. It is signed by [name], [role].";
    const filled = fillText(agreement, { name: "Jane Citizen", role: "Owner" });
    expect(filled).toContain("or their representative [name].");
    expect(filled).toContain("It is signed by Jane Citizen, Owner.");
    expect(
      fillText("[name] is reached on [phone or email].", {
        name: "Jane Citizen",
        "phone-or-email": "0400 000 000",
      }),
    ).toBe("Jane Citizen is reached on 0400 000 000.");
  });

  it("FR-10: a form blank is open until the facts hold its key, whatever the stored text says", () => {
    // The stored text keeps every bracket from REQ-029 on, so the count reads the facts.
    const blanks = [
      { blank: "[phone or email]" },
      { blank: "[name]" },
      { blank: "[other tool]" },
      { blank: "[phone or email]" },
      { blank: "[Signature]" },
    ];
    const none = openFormBlanks(blanks, {});
    expect(none.map((b) => b.blank)).toEqual([
      "[phone or email]",
      "[other tool]",
      "[phone or email]",
    ]);
    expect(
      openFormBlanks(blanks, { "phone-or-email": "0400 000 000" }).map(
        (b) => b.blank,
      ),
    ).toEqual(["[other tool]"]);
    expect(openFormBlanks(blanks, { "phone-or-email": "   " })).toHaveLength(3);
    expect(
      openFormBlanks(blanks, {
        "phone-or-email": "0400 000 000",
        "other-tool": "None",
      }),
    ).toEqual([]);
  });
});

describe("REQ-029 FR-1, SR-6: the details page's questions and the value rule", () => {
  it("asks every key the set uses once, name and role first and always, never the date, in FR-1's order then reading order", () => {
    const blanks = [
      "[period]",
      "[phone or email]",
      "[name]",
      "[date]",
      "[other tool]",
      "[allowed use]",
      "[limits]",
      "[role]",
      "[owner role]",
      "[fax number]",
      "[phone or email]",
    ].map((blank) => ({
      typeId: "x",
      title: "x",
      sectionNumber: "1",
      sectionHeading: "h",
      blank,
    }));
    expect(detailsQuestionsFor(blanks).map((q) => q.key)).toEqual([
      "name",
      "role",
      "phone-or-email",
      "period",
      "other-tool",
      "allowed-use",
      "limits",
      "fax-number",
    ]);
    // A set with no name or role blank still asks for the approver (FR-5).
    expect(detailsQuestionsFor([]).map((q) => q.key)).toEqual(["name", "role"]);
  });

  it("refuses square brackets and control characters, so a value is never read as a blank", () => {
    expect(isFactValueAllowed("Jane Citizen")).toBe(true);
    expect(isFactValueAllowed("0400 000 000")).toBe(true);
    expect(isFactValueAllowed("[name]")).toBe(false);
    expect(isFactValueAllowed("Jane ] Citizen")).toBe(false);
    expect(isFactValueAllowed("line" + String.fromCharCode(10) + "break")).toBe(
      false,
    );
    expect(isFactValueAllowed("tab" + String.fromCharCode(9) + "here")).toBe(
      false,
    );
  });
});
