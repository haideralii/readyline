import { describe, expect, it } from "vitest";
import { lintErrors, lintReviewCycles, lintText, lintTimeframes } from "./lint";

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
});
