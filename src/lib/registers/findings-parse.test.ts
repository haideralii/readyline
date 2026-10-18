// @vitest-environment node
/**
 * REQ-033 FR-1, FR-2 (D-2930, D-2931): the sample report's three items become
 * three candidates with their severities, the standards their words name
 * and the gate's warning on the one that names a person; a block without a
 * finding word is left out; long text is cut on a word; table rows stand
 * alone.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getStandardsDataset } from "@/lib/standards/dataset";
import {
  FINDING_MAX_CHARS,
  findingCandidates,
  foldCandidateText,
  severityFromWords,
  splitBlocks,
  standardFromWords,
} from "./findings-parse";

const report = readFileSync("fixtures/findings/sample-report.txt", "utf8");
const idOf = (name: string) =>
  getStandardsDataset().standards.find((s) => s.name === name)?.id ?? "";

describe("candidate findings from a report (REQ-033 FR-1)", () => {
  it("finds the three items of the sample report, with their severities and the standards their words name", () => {
    const c = findingCandidates(report);
    expect(c).toHaveLength(3);
    expect(c.map((x) => x.severity)).toEqual(["minor", "major", "observation"]);
    expect(c[0].text).toMatch(/^1\. Minor non-conformity\./);
    expect(c[0].standardId).toBe(idOf("Incident management"));
    expect(c[1].standardId).toBe(idOf("Risk management"));
    expect(c.every((x) => !x.truncated)).toBe(true);
  });

  it("FR-2: the item naming a person carries the detector's name warning; the others carry none", () => {
    const c = findingCandidates(report);
    expect(c[2].warnings).toHaveLength(1);
    expect(c[2].warnings[0]).toContain("person's name");
    expect(c[0].warnings).toEqual([]);
    expect(c[1].warnings).toEqual([]);
  });

  it("leaves out a block with none of the finding words, and reads a table row as one candidate", () => {
    expect(
      findingCandidates(
        "The audit was held on two days.\n\nLunch was provided.",
      ),
    ).toEqual([]);
    const table =
      "Ref\tStandard\tSeverity\nNC-01\tComplaints management\tMinor non-conformity\n";
    const c = findingCandidates(table);
    // The header row is a heading (under the length floor); the row is one candidate.
    expect(c.map((x) => x.text)).toEqual([
      "NC-01; Complaints management; Minor non-conformity",
    ]);
    expect(c[0].standardId).toBe(idOf("Complaints management"));
  });

  it("splits numbered items and blank-line paragraphs, and folds whitespace", () => {
    expect(
      splitBlocks("1. First finding\nruns on\n2) Second finding\n\nThird para"),
    ).toEqual(["1. First finding runs on", "2) Second finding", "Third para"]);
    const long = `Finding: ${"word ".repeat(200)}`;
    const folded = foldCandidateText(long);
    expect(folded.truncated).toBe(true);
    expect(folded.text.length).toBeLessThanOrEqual(FINDING_MAX_CHARS);
    expect(folded.text.endsWith("word")).toBe(true);
  });

  it("reads the severity from the words, major before minor, observation and OFI, minor when none", () => {
    expect(severityFromWords("A major non-conformity, with a minor note")).toBe(
      "major",
    );
    expect(severityFromWords("Minor non-conformity")).toBe("minor");
    expect(severityFromWords("Observation: consider codes")).toBe(
      "observation",
    );
    expect(severityFromWords("An opportunity for improvement")).toBe(
      "observation",
    );
    expect(severityFromWords("Finding against the standard")).toBe("minor");
    expect(standardFromWords("nothing here")).toBe("");
  });
});
