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
  formQuestionsFor,
  isAccountFactKey,
  questionsFor,
  remainingBlanks,
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

  it("the three fixed blanks fill from the account facts: approver, approval date, change-log author", () => {
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
