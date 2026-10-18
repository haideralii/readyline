// @vitest-environment node
/**
 * REQ-033 FR-3, FR-6, FR-7, SR-2 (D-2932, D-2936): the register's words
 * carry no "resolve", "clear" or "pass"; the schema refuses a finding the
 * detector flags with the detector's message and holds the status to its
 * dates; the card counts by the provider's record; the state tag names what
 * the provider did.
 */
import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import { parseInput } from "@/lib/validation";
import {
  FINDINGS_ADD_LABEL,
  FINDINGS_IMPORT_LABEL,
  FINDINGS_INTRO,
  FINDING_ADDRESS_LABEL,
  FINDING_FIELDS,
  FINDING_VERIFY_LABEL,
  FindingForm,
  findingStateTag,
  findingsCardLine,
  standardOptions,
  type FindingListRow,
} from "./findings";

const row = (over: Partial<FindingListRow> = {}): FindingListRow => ({
  id: "f",
  account_id: "a",
  reference: "FND-0001",
  standard_id: "",
  indicator: "",
  severity: "minor",
  finding: "x",
  due_on: null,
  status: "open",
  addressed_on: null,
  addressed_by_role: "",
  verified_on: null,
  improvement_id: null,
  created_by: null,
  created_at: "2026-10-18",
  updated_at: "2026-10-18",
  state: "open",
  ...over,
});

const valid = {
  standard_id: "",
  indicator: "",
  severity: "minor",
  finding: "The incident register had no record of the Commission being told.",
  due_on: "",
  status: "open",
  addressed_on: "",
  addressed_by_role: "",
  verified_on: "",
};

describe("the findings register's words and schema (REQ-033)", () => {
  it("FR-7: the intro is the lawyer's sentence and no button says resolve, clear or pass", () => {
    expect(FINDINGS_INTRO).toBe(
      "Type or paste your auditor's findings in your own words. Readyline shows which document and section in your pack answers each one and keeps the record of what you changed. It does not decide whether a finding is closed; your auditor does.",
    );
    for (const label of [
      FINDINGS_ADD_LABEL,
      FINDINGS_IMPORT_LABEL,
      FINDING_ADDRESS_LABEL,
      FINDING_VERIFY_LABEL,
    ])
      expect(label).not.toMatch(/resolve|clear|pass/i);
    expect(FINDING_ADDRESS_LABEL).toBe("Mark as addressed");
    expect(FINDING_VERIFY_LABEL).toBe("Record the auditor's verification");
    expect(findProhibitedClaims(FINDINGS_INTRO)).toEqual([]);
  });

  it("SR-2: the schema refuses a finding the detector flags, with its message, and holds a status to its dates", () => {
    expect(parseInput(FindingForm, valid).ok).toBe(true);
    const flagged = parseInput(FindingForm, {
      ...valid,
      finding: "A support note for Mr J. Smith named him in full.",
    });
    expect(flagged.ok).toBe(false);
    if (!flagged.ok)
      expect(flagged.fieldErrors.finding?.[0]).toContain("person's name");
    const noDate = parseInput(FindingForm, { ...valid, status: "addressed" });
    expect(noDate.ok).toBe(false);
    if (!noDate.ok) expect(noDate.fieldErrors.addressed_on?.[0]).toBeTruthy();
    const verified = parseInput(FindingForm, {
      ...valid,
      status: "verified",
      addressed_on: "2026-10-01",
    });
    expect(verified.ok).toBe(false);
    if (!verified.ok)
      expect(verified.fieldErrors.verified_on?.[0]).toBeTruthy();
    expect(parseInput(FindingForm, { ...valid, severity: "critical" }).ok).toBe(
      false,
    );
  });

  it("FR-3: the standards list is grouped by module in the label, with the unmapped choice first", () => {
    const options = standardOptions();
    expect(options[0]).toEqual({
      value: "",
      label: "Not yet mapped to a standard",
    });
    expect(options.length).toBeGreaterThan(20);
    expect(options[1].label).toMatch(/^.+: .+$/);
    expect(FINDING_FIELDS.map((f) => f.name)).toContain("standard_id");
  });

  it("FR-6: the card counts open (with overdue), addressed and verified, leaving zero parts out", () => {
    expect(
      findingsCardLine([
        row(),
        row({ state: "overdue" }),
        row({ state: "addressed" }),
        row({ state: "verified" }),
      ]),
    ).toBe(
      "Findings from your last audit: 2 open, 1 addressed, 1 verified by the auditor",
    );
    expect(findingsCardLine([row({ state: "verified" })])).toBe(
      "Findings from your last audit: 1 verified by the auditor",
    );
    expect(findingsCardLine([])).toBe(
      "Findings from your last audit: none open",
    );
  });

  it("the state tag names what the provider did, in words, with the date", () => {
    expect(findingStateTag(row({ due_on: "2026-11-30" }))).toEqual({
      key: "open",
      label: "Open, due 30 November 2026",
      tone: "ochre",
    });
    expect(
      findingStateTag(row({ state: "overdue", due_on: "2026-09-01" })).label,
    ).toBe("Overdue since 1 September 2026");
    expect(
      findingStateTag(row({ state: "addressed", addressed_on: "2026-10-02" }))
        .label,
    ).toBe("Addressed 2 October 2026");
    expect(
      findingStateTag(row({ state: "verified", verified_on: "2026-10-09" }))
        .label,
    ).toBe("Verified by the auditor 9 October 2026");
  });
});
