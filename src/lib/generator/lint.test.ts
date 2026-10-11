import { describe, expect, it } from "vitest";
import { lintErrors, lintText } from "./lint";

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
});
