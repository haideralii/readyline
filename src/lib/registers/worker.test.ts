import { describe, expect, it } from "vitest";
import {
  AWARE_HOURS,
  DRAFT_LIMIT,
  INVITATION_DAYS,
  InviteForm,
  REPORTER_ROLES,
  ReportForm,
  ReporterField,
  awareSentence,
  invitationExpiry,
  invitePath,
  reportPath,
  reportsToConfirmLine,
} from "./worker";

/**
 * REQ-020 Session B, the pure rules: the report form's schema (SR-3: "who
 * are you" is a code or a role, never a name; the free text refuses an NDIS
 * number), the invitation's schema and expiry, the awareness sentence the
 * confirmation screen shows, and the "N reports to confirm" line.
 */
const report = (over: Record<string, unknown> = {}) => ({
  occurredOn: "2026-10-14",
  category: "near-miss",
  severity: "low",
  participantRef: "p-014",
  workerRef: "",
  summary: "Near miss in the kitchen; no harm.",
  actionsTaken: "",
  reporter: "support worker",
  ...over,
});

describe("the reporter field (FR-5, SR-3)", () => {
  it.each(["W-003", "w-003", "W3", "w12"])(
    "accepts the worker code %s and upper-cases it",
    (code) => {
      const r = ReporterField.safeParse(code);
      expect(r.success).toBe(true);
      expect(r.data).toBe(code.toUpperCase());
    },
  );
  it.each(REPORTER_ROLES)("accepts the role %s as written", (role) => {
    expect(ReporterField.safeParse(role)).toMatchObject({
      success: true,
      data: role,
    });
  });
  it.each(["Jane Citizen", "jane@example.test", "Support Worker", "", "W-"])(
    "refuses %j: never a name, never free text",
    (value) => {
      expect(ReporterField.safeParse(value).success).toBe(false);
    },
  );
});

describe("the report form (FR-5)", () => {
  it("accepts a complete report and upper-cases the codes", () => {
    const r = ReportForm.safeParse(report());
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({
      participantRef: "P-014",
      workerRef: null,
      reporter: "support worker",
    });
  });
  it("refuses an NDIS participant number in the summary (SR-3)", () => {
    const r = ReportForm.safeParse(
      report({ summary: "Participant 430123456 fell in the hallway." }),
    );
    expect(r.success).toBe(false);
  });
  it("refuses the Commission-notification fields: they are the owner's (FR-5)", () => {
    expect(ReportForm.safeParse(report({ reportable: true })).success).toBe(
      false,
    );
    expect(
      ReportForm.safeParse(report({ reportableNotifiedOn: "2026-10-15" }))
        .success,
    ).toBe(false);
  });
  it("needs the date, the category, the severity and a summary", () => {
    for (const missing of ["occurredOn", "category", "severity", "summary"])
      expect(
        ReportForm.safeParse(report({ [missing]: "" })).success,
        missing,
      ).toBe(false);
  });
});

describe("the invitation (FR-4, SR-5)", () => {
  it("lower-cases the address and upper-cases the code", () => {
    const r = InviteForm.safeParse({
      email: " Sam.Worker@Example.test ",
      workerRef: "w-007",
    });
    expect(r.success).toBe(true);
    expect(r.data).toEqual({
      email: "sam.worker@example.test",
      workerRef: "W-007",
    });
  });
  it("refuses a name as the code and a bad address", () => {
    expect(
      InviteForm.safeParse({ email: "sam@example.test", workerRef: "Sam" })
        .success,
    ).toBe(false);
    expect(
      InviteForm.safeParse({ email: "not an address", workerRef: "W-1" })
        .success,
    ).toBe(false);
  });
  it("expires seven days from now, and the paths carry the token only", () => {
    expect(INVITATION_DAYS).toBe(7);
    const now = new Date("2026-10-15T08:00:00Z");
    expect(invitationExpiry(now).toISOString()).toBe(
      "2026-10-22T08:00:00.000Z",
    );
    expect(invitePath("abc")).toBe("/invite/abc");
    expect(reportPath("abc")).toBe("/report/abc");
  });
});

describe("the owner's lines (FR-5, FR-6; PO review 14 Oct)", () => {
  it("the awareness sentence names when the report came in and the 24-hour mark, Sydney time", () => {
    expect(AWARE_HOURS).toBe(24);
    // 09:30 UTC on 14 Oct is 20:30 in Sydney (AEDT, UTC+11).
    expect(awareSentence(new Date("2026-10-14T09:30:00Z"))).toBe(
      "Reported 14 October, 8:30 pm; if this is a reportable incident the Commission must be told by 15 October, 8:30 pm.",
    );
  });
  it("counts reports in words and says nothing at zero", () => {
    expect(reportsToConfirmLine(0)).toBeNull();
    expect(reportsToConfirmLine(1)).toBe("1 report to confirm");
    expect(reportsToConfirmLine(3)).toBe("3 reports to confirm");
  });
  it("the draft limit is ten (FR-5)", () => {
    expect(DRAFT_LIMIT).toBe(10);
  });
});
