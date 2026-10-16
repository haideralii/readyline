// @vitest-environment node
/**
 * REQ-027 A2 (FR-3a, FR-3b; D-2707, D-2716, D-2718, D-2722, D-2723, D-2725):
 * the result page's copy and its two list rules, read without React.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import { lintText } from "@/lib/copy-lint/rules";
import {
  HAVE_TAG,
  NEXT_LINE,
  SOLE_TRADER_LINE,
  SOLE_TRADER_SOURCE,
  countHave,
  haveCounts,
  haveLegend,
} from "./result-copy";

const items = (...have: string[]) =>
  have.map((h) => ({ have: h as "yes" | "no" | "not-sure" | "unknown" }));

describe("the group summary's parts (D-2725)", () => {
  it("counts yes, need and not sure each in its own part, never a not-sure row under you need, and no part for an unasked row", () => {
    expect(
      countHave(items("yes", "no", "not-sure", "unknown", "unknown")),
    ).toEqual({ yes: 1, need: 1, notSure: 1 });
    expect(haveCounts(items("yes", "no", "unknown", "unknown"))).toBe(
      "1 you have, 1 you need",
    );
    expect(haveCounts(items("not-sure", "unknown", "unknown"))).toBe(
      "1 not sure",
    );
    expect(haveCounts(items("unknown", "unknown"))).toBe("");
    expect(haveCounts(items("yes", "yes", "no", "not-sure", "no"))).toBe(
      "2 you have, 2 you need, 1 not sure",
    );
  });

  it("the tag table has the three answered states in the reader's words and nothing for an unasked row (D-2716, D-2718)", () => {
    expect(Object.keys(HAVE_TAG).sort()).toEqual(["no", "not-sure", "yes"]);
    expect(HAVE_TAG.yes?.label).toBe("You have one");
    expect(HAVE_TAG.no?.label).toBe("You need one");
    expect(HAVE_TAG["not-sure"]?.label).toBe("You said not sure");
    expect("unknown" in HAVE_TAG).toBe(false);
  });
});

describe("the legend, the Next line and the sole-trader pair (D-2707, D-2718, D-2722, D-2723)", () => {
  it("the legend is D-2718's five sentences with the numeral, averaging under 20 words, none over 30", () => {
    const legend = haveLegend(3);
    expect(legend).toBe(
      "Your pack drafts every document below. Where you have one, keep yours or use ours. Where you need one, ours is your starting point. We asked about 3 of the documents below in the last step. The tags are your answers from the last step.",
    );
    const sentences = legend.split(/(?<=\.)\s+/);
    expect(sentences).toHaveLength(5);
    const words = sentences.map((s) => s.split(/\s+/).length);
    expect(Math.max(...words)).toBeLessThanOrEqual(30);
    expect(words.reduce((a, b) => a + b, 0) / words.length).toBeLessThan(20);
    expect(haveLegend(0)).toContain("We asked about 0 of the documents");
  });

  it("every customer sentence here is claim-free and lint-clean (D-2706, finding 107)", () => {
    for (const text of [
      NEXT_LINE,
      haveLegend(3),
      SOLE_TRADER_LINE,
      SOLE_TRADER_SOURCE.text,
      ...Object.values(HAVE_TAG).map((t) => t!.label),
    ]) {
      expect(findProhibitedClaims(text), text).toEqual([]);
      expect(lintText(text, { block: true }), text).toEqual([]);
    }
  });

  it("the Next line names the screen a new account is sent to, read from that page's heading, and its comment names D-2707 and the reader (AC-4, findings 85 and 134)", () => {
    const setup = readFileSync(
      resolve(process.cwd(), "src/app/account/setup/page.tsx"),
      "utf8",
    );
    const heading = /<h1[^>]*>\s*([^<]+?)\s*<\/h1>/.exec(setup)?.[1];
    expect(heading).toBeTruthy();
    expect(NEXT_LINE).toContain(`'${heading}'`);
    expect(NEXT_LINE).toMatch(/^Next: sign in, then/);
    expect(NEXT_LINE).not.toMatch(/\d+\s*minute/i);
    const source = readFileSync(
      resolve(process.cwd(), "src/app/start/_components/steps/result-copy.ts"),
      "utf8",
    );
    const comment = source.slice(0, source.indexOf("export const NEXT_LINE"));
    expect(comment).toContain("D-2707");
    expect(comment).toContain("a new account");
  });

  it("the sole-trader pair states the rule and its source in the reasons' shape, the link to the Commission's page (D-2723)", () => {
    expect(SOLE_TRADER_LINE).toBe(
      "A sole trader needs the clearance in their own name.",
    );
    expect(SOLE_TRADER_SOURCE.text).toBe(
      "Worker Screening Rules s 13(c), with few exceptions.",
    );
    expect(SOLE_TRADER_SOURCE.source.title).toBe(
      "NDIS Worker Screening Check (NDIS Commission)",
    );
    expect(SOLE_TRADER_SOURCE.source.url).toMatch(
      /^https:\/\/www\.ndiscommission\.gov\.au\//,
    );
    expect(SOLE_TRADER_LINE).not.toMatch(/too|worker/i);
  });
});
