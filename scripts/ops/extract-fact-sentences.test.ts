// @vitest-environment node
/**
 * REQ-012 FR-4b (AC-9): the extractor finds the sentences that carry a
 * number, a date, a dollar amount, a time frame, a hedge word or an
 * instrument, over fixtures of each file kind; a code alone is not a fact;
 * the noise list drops a sentence by its text; precision counts the found
 * sentences the table carries verbatim.
 */
import { describe, expect, it } from "vitest";
import {
  classify,
  factSentences,
  jsonProse,
  markdownProse,
  noiseKind,
  precision,
  sentencesOf,
  tsProse,
} from "./extract-fact-sentences-lib.mjs";

describe("the fact-sentence extractor (REQ-012 FR-4b)", () => {
  it("classifies each class the REQ names and leaves plain sentences alone", () => {
    expect(
      classify("Registration lasts three years and costs about $2,800."),
    ).toEqual(["number", "dollar"]);
    expect(
      classify("The mid-term audit falls no later than 18 months in."),
    ).toEqual(["number"]);
    expect(classify("The SIL deadline is 1 October 2026.")).toEqual([
      "number",
      "date",
    ]);
    expect(classify("You can finish the questionnaire in 10 minutes.")).toEqual(
      ["number", "time"],
    );
    expect(classify("Most providers keep a register for seven years.")).toEqual(
      ["hedge"],
    );
    expect(classify("Rules s 20 sets the 24-hour notification.")).toEqual([
      "number",
      "instrument",
    ]);
    expect(classify("The Practice Standards name four core modules.")).toEqual([
      "instrument",
    ]);
    expect(classify("Your documents are drafted from your answers.")).toEqual(
      [],
    );
    expect(classify("W-003")).toEqual([]);
  });

  it("noise by shape: interface copy with a digit is not a fact candidate", () => {
    for (const s of [
      "Enter 500 or fewer workers",
      "Up to 200 characters; a few words are enough.",
      "A phone number or an email address, for example 0400 000 000.",
      "1 document drafted so far.",
      "Step 3 of 6",
      "Worker W-003 is pending.",
      "mt-3 flex min-h-11 items-start gap-2 text-sm leading-6",
      "11 digits, spaces allowed.",
    ])
      expect(noiseKind(s), s).not.toBeNull();
    expect(
      noiseKind("Registration lasts three years and costs about $2,800."),
    ).toBeNull();
    const found = factSentences("m.ts", [
      {
        line: 1,
        text: "Enter 500 or fewer workers. Registration lasts 3 years.",
      },
    ]);
    expect(found.map((f) => f.sentence)).toEqual([
      "Registration lasts 3 years.",
    ]);
  });

  it("splits prose into sentences and keeps short fragments out", () => {
    expect(
      sentencesOf("One costs $900. Two is free! Three? Four fours."),
    ).toEqual(["One costs $900.", "Two is free!"]);
  });

  it("reads markdown prose without front matter, headings, marks, links or table pipes", () => {
    const md = `---\ntitle: x\nupdated: 2026-10-13\n---\n# Heading 1\n\nA **certification audit** costs [about $4,000](https://example.test) in 2026.\n\n| Audit | Cost |\n| --- | --- |\n| Verification | AUD 900 to 1,800 |\n`;
    const prose = markdownProse(md);
    expect(prose.map((p) => p.text.trim())).toContain(
      "A certification audit costs about $4,000 in 2026.",
    );
    expect(
      prose.some((p) => /Verification\. AUD 900 to 1,800/.test(p.text)),
    ).toBe(true);
    expect(prose.some((p) => /updated: 2026/.test(p.text))).toBe(false);
    const found = factSentences("g.md", prose);
    expect(found.map((f) => f.classes)).toContainEqual([
      "number",
      "date",
      "dollar",
    ]);
  });

  it("reads a module's string literals and JSX text, never its comments", () => {
    const ts = `// 18 months is the rule\nexport const COPY = {\n  line: "Start preparing 12 months in advance of the audit.",\n  short: "Ok",\n};\nconst jsx = <p>The Commission suggests you keep every record.</p>;`;
    const items = tsProse(ts);
    expect(items.map((i) => i.text)).toEqual([
      "Start preparing 12 months in advance of the audit.",
      "The Commission suggests you keep every record.",
    ]);
    expect(factSentences("m.ts", items).map((f) => f.classes)).toEqual([
      ["number"],
      ["hedge"],
    ]);
  });

  it("reads every string value of a JSON document", () => {
    const items = jsonProse(
      JSON.stringify({
        items: [
          {
            description:
              "Typically the quicker and cheaper audit for lower-risk groups.",
          },
        ],
      }),
    );
    expect(items).toHaveLength(1);
    expect(factSentences("c.json", items)[0].classes).toEqual(["hedge"]);
  });

  it("precision counts the found sentences the table carries verbatim and lists the rest", () => {
    const found = factSentences("g.md", [
      {
        line: 1,
        text: "Registration lasts three years. The fee is $0. Usually the auditor visits.",
      },
    ]);
    expect(found).toHaveLength(2);
    const p = precision(
      found,
      "| The fee is $0. | g.md:1 | regulatory fact | Act s 73E | | | | | | | VERIFIED | |\n| Usually the auditor visits. | g.md:1 | hedge (D-2911) | | | | | | | | UNVERIFIED | |",
    );
    expect(p.found).toBe(2);
    expect(p.mapped).toBe(1);
    expect(p.unmapped.map((f) => f.sentence)).toEqual([
      "Usually the auditor visits.",
    ]);
  });
});
