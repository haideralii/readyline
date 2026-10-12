import { describe, expect, it } from "vitest";
import {
  lintCrossReferences,
  lintErrors,
  lintReviewCycles,
  lintText,
  lintTimeframes,
} from "./lint";

describe("terminology and claims lint (REQ-005 AC-9, house style)", () => {
  it("passes house-style prose", () => {
    const text =
      "We tell each participant how to raise a concern. A worker records the concern the same day. We review this policy every 12 months.";
    expect(lintText(text)).toEqual([]);
  });

  it("flags the wrong words for participant and worker as errors", () => {
    const f = lintText(
      "Our clients and staff members meet the carer each week.",
    );
    expect(f.map((x) => x.rule)).toEqual([
      "term-participant",
      "term-worker",
      "term-worker",
    ]);
    expect(lintErrors(f)).toHaveLength(3);
  });

  it("warns on Latinate words and American spelling, errors on exclamation marks and please", () => {
    const f = lintText("Please utilise the form! We organize training.");
    expect(f.map((x) => `${x.rule}:${x.severity}`)).toEqual([
      "no-please:error",
      "plain-words:warn",
      "no-exclamation:error",
      "spelling-american:warn",
    ]);
  });

  it("flags compliance claims and the CLAUDE.md prohibited claims", () => {
    const f = lintText(
      "This policy is fully compliant and complies with the standards. Registration guaranteed. Approved by auditors.",
    );
    const rules = f.map((x) => x.rule);
    expect(rules).toContain("claim-words");
    expect(rules).toContain("claim-complies");
    expect(rules).toContain("claims:approved-by-authority");
    expect(lintErrors(f).length).toBeGreaterThanOrEqual(4);
  });

  it("ignores words inside the Commission's class names", () => {
    const text =
      "We deliver Assistance with daily personal activities. We help each participant at home.";
    expect(
      lintText(text, {
        allowedPhrases: ["Assistance with daily personal activities"],
      }),
    ).toEqual([]);
    expect(lintText(text).map((x) => x.rule)).toEqual(["plain-words-assist"]);
  });
  it("R-7: flags restated statutory timeframes and nothing else", () => {
    const f = lintTimeframes(
      "We report the most serious incidents within 24 hours and the rest within 5 business days. We record it within three working days.",
    );
    expect(f.map((x) => x.match)).toEqual([
      "within 24 hours",
      "within 5 business days",
      "within three working days",
    ]);
    expect(
      lintTimeframes(
        "We follow the timeframes in section 7 Reportable incidents.",
      ),
    ).toEqual([]);
    expect(lintTimeframes("We review this every 12 months.")).toEqual([]);
  });
  it("R-8: review cycles must match the document's facts, by subject", () => {
    const cycles = { policyMonths: 12, registerMonths: 3 };
    expect(
      lintReviewCycles(
        "We review this policy every 12 months. We check the register every 3 months.",
        cycles,
      ),
    ).toEqual([]);
    const wrong = lintReviewCycles(
      "We review the register every 12 months. We review this procedure every six months. We look at it every year.",
      cycles,
    );
    expect(wrong.map((f) => f.match)).toEqual([
      "every 12 months",
      "every six months",
    ]);
    expect(wrong[0].why).toMatch(/register review every 3 months/);
    expect(
      lintReviewCycles("We check our records every week.", cycles),
    ).toHaveLength(1);
    // D-043: cadences without review wording are not review cycles (R-7 covers statutory ones).
    expect(
      lintReviewCycles(
        "We meet every week. Because we use regulated restrictive practices, steps 1 and 2 apply every month. We send the report every month.",
        cycles,
      ),
    ).toEqual([]);
    // A table row is one statement: the register cell sets the subject for the cycle cell.
    expect(
      lintReviewCycles(
        "Role | Does what | When\nOwner | Reviews the register for patterns. Updates this policy. | At least every 12 months\nOwner | Checks the register | every 3 months",
        cycles,
      ).map((f) => f.match),
    ).toEqual(["every 12 months"]);
    expect(
      lintReviewCycles(
        "Every year we check the register and every month we file.",
        cycles,
      ).map((f) => f.match),
    ).toEqual(["Every year", "every month"]);
  });

  it("R-8: a sentence or row that gives each subject its own cycle passes (batch 15 false positive)", () => {
    const cycles = { policyMonths: 12, registerMonths: 3 };
    expect(
      lintReviewCycles(
        "We review this policy every 12 months and the incident register every 3 months. We update our practice when the review shows something needs to change.",
        cycles,
      ),
    ).toEqual([]);
    expect(
      lintReviewCycles(
        "Role | Does what | When\nOwner | Reviews this policy and the complaints register. See section 11 Review. | Policy every 12 months; register every 3 months",
        cycles,
      ),
    ).toEqual([]);
    // One cycle for both subjects is still wrong, whichever order they come in.
    expect(
      lintReviewCycles(
        "We review this policy and our register every 12 months.",
        cycles,
      ).map((f) => f.match),
    ).toEqual(["every 12 months"]);
    expect(
      lintReviewCycles(
        "We review the register every 3 months and this policy every 3 months.",
        cycles,
      ).map((f) => f.match),
    ).toEqual(["every 3 months"]);
  });

  it("terminology: 'carers' meaning family carers is not a worker synonym (D-532 proposal)", () => {
    expect(
      lintText(
        "We welcome complaints from participants, their families and carers, and advocates. Family carers and unpaid carers can complain for a participant.",
      ),
    ).toEqual([]);
    expect(
      lintText("Our carers record each shift.").map((f) => f.rule),
    ).toEqual(["term-worker"]);
    expect(
      lintText("A carer completes the register.").map((f) => f.rule),
    ).toEqual(["term-worker"]);
  });

  it("R-9: cross-references must name a section of this document's outline", () => {
    const outline = [
      { number: "1", heading: "Purpose" },
      { number: "2", heading: "Scope" },
      { number: "3", heading: "Definitions" },
      { number: "7", heading: "Reportable incidents" },
      { number: "8", heading: "Incident procedure" },
    ];
    // Right number, right title, or no title: fine, including a lead-in after the title.
    expect(
      lintCrossReferences(
        "See section 7 Reportable incidents for what to report and by when. Section 3 explains the terms. Timeframes are in section 7. We follow section 8 Incident procedure straight away.",
        outline,
      ),
    ).toEqual([]);
    // The house style's generic structure quoted in a document that has no such section.
    const wrong = lintCrossReferences(
      "Timeframes are in section 3 What we do. See section 4 Records we keep. Section 9 covers review. See section 3 Reportable incidents.",
      outline,
    );
    expect(wrong.map((f) => f.match)).toEqual([
      "section 3 What we do",
      "section 4 Records we keep",
      "section 9",
      "section 3 Reportable incidents",
    ]);
    expect(wrong[0].why).toMatch(/section 3 is Definitions/);
    expect(wrong[0].why).toMatch(/no section is called What we do/);
    expect(wrong[1].why).toMatch(/no section 4 in this document/);
    expect(wrong[3].why).toMatch(/Reportable incidents is section 7/);
    expect(wrong[3].why).toMatch(/1 Purpose, 2 Scope, 3 Definitions/);
  });
});
