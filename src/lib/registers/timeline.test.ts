/**
 * REQ-023 Session A, AC-1 and FR-2, FR-3 with a fixed clock (finding 57: the
 * clock lives here, the e2e seeds dates relative to the run). The certificate
 * fixture: a certification period from 1 March 2026 to 1 March 2029, read on
 * 15 October 2026.
 */
import { describe, expect, it } from "vitest";
import type { MidTermAudit } from "@/lib/standards/derive";
import { addMonths, formatLongDate, monthsBetween } from "./status";
import {
  REGISTRATION_REMINDER_KINDS,
  legalRows,
  midtermFor,
  mustStartBy,
  ownershipAuditStartBy,
  positionSentence,
  registrationReminderLine,
  registrationReminders,
  timelineRows,
  type RegistrationPeriod,
} from "./timeline";

const TODAY = "2026-10-15";

const period = (
  over: Partial<RegistrationPeriod> = {},
): RegistrationPeriod => ({
  id: "per-1",
  period_starts_on: "2026-03-01",
  period_ends_on: "2029-03-01",
  audit_type: "certification",
  midterm_applies: true,
  midterm_exempt_reason: null,
  midterm_start_by_override: null,
  midterm_override_source: null,
  last_audit_on: null,
  midterm_audit_on: null,
  ...over,
});

const byId = (rows: ReturnType<typeof timelineRows>) =>
  Object.fromEntries(rows.map((r) => [r.id, r]));

describe("the timeline (AC-1)", () => {
  it("reads the five rows with their dates and source words for the certification fixture", () => {
    const rows = timelineRows(period());
    expect(rows.map((r) => [r.id, r.date, r.source])).toEqual([
      ["midterm-prepare", "2027-03-01", "our suggestion"],
      ["midterm-start-by", "2027-09-01", "Rules s 13B"],
      ["renewal-window", "2028-09-01", "NDIS Act s 73K"],
      ["renewal-apply-by", "2028-12-01", "our suggestion"],
      ["period-end", "2029-03-01", "your certificate"],
    ]);
    expect(rows.map((r) => r.label)).toEqual([
      "Prepare for your mid-term audit from",
      "Your mid-term audit must start by",
      "Your renewal window opens",
      "Apply for renewal by",
      "Your registration period ends",
    ]);
    expect(byId(rows)["renewal-window"].plain).toBe(
      "The earliest day an application keeps your registration in force while the Commission decides.",
    );
  });

  it("the position sentence names the months in and the two mid-term dates", () => {
    expect(positionSentence(period(), TODAY)).toBe(
      "You are 7 months in. Prepare for your mid-term audit from 1 March 2027; it must start by 1 September 2027, unless your certificate's conditions say otherwise.",
    );
  });

  it("an override date replaces the must-start-by row and names its source (finding 79)", () => {
    const condition = period({
      midterm_start_by_override: "2027-12-01",
      midterm_override_source: "condition",
    });
    expect(byId(timelineRows(condition))["midterm-start-by"]).toMatchObject({
      date: "2027-12-01",
      source: "your certificate's conditions",
    });
    expect(positionSentence(condition, TODAY)).toContain(
      "it must start by 1 December 2027 (the date your certificate's conditions set).",
    );
    const letter = period({
      midterm_start_by_override: "2027-12-01",
      midterm_override_source: "letter",
    });
    expect(byId(timelineRows(letter))["midterm-start-by"].source).toBe(
      "the Commissioner's letter",
    );
    expect(mustStartBy(letter)).toBe("2027-12-01");
  });

  it("a verification period has no mid-term rows and the shorter sentence", () => {
    const v = period({ audit_type: "verification", midterm_applies: false });
    expect(timelineRows(v).map((r) => r.id)).toEqual([
      "renewal-window",
      "renewal-apply-by",
      "period-end",
    ]);
    expect(positionSentence(v, TODAY)).toBe(
      "You are 7 months in. Your renewal window opens 1 September 2028.",
    );
  });

  it("a done mid-term audit replaces the two mid-term rows with the done date", () => {
    const rows = timelineRows(period({ midterm_audit_on: "2027-08-20" }));
    expect(rows.map((r) => r.id)).toEqual([
      "midterm-done",
      "renewal-window",
      "renewal-apply-by",
      "period-end",
    ]);
    expect(rows[0]).toMatchObject({
      label: "Mid-term audit done on",
      date: "2027-08-20",
      legal: true,
    });
  });

  it("the audit-day copy keeps the legal rows, the period end and the done dates only (D-2314)", () => {
    expect(legalRows(timelineRows(period())).map((r) => r.id)).toEqual([
      "midterm-start-by",
      "renewal-window",
      "period-end",
    ]);
    expect(
      legalRows(timelineRows(period({ midterm_audit_on: "2027-08-20" }))).map(
        (r) => r.id,
      ),
    ).toEqual(["midterm-done", "renewal-window", "period-end"]);
  });

  it("the four other sentence forms, most pressing first", () => {
    expect(positionSentence(period(), "2027-09-02")).toBe(
      "Your mid-term audit was due to start by 1 September 2027, unless your certificate's conditions say otherwise; record the date it started.",
    );
    expect(positionSentence(period(), "2028-09-01")).toBe(
      "Your renewal window is open. Apply by 1 December 2028 (our suggestion).",
    );
    expect(positionSentence(period(), "2028-12-02")).toBe(
      "If you have not applied between 1 September 2028 and 1 March 2029, your registration ends on 1 March 2029 (NDIS Act s 73K); an earlier application does not keep it in force.",
    );
    // Finding 83: an application inside the window keeps the window sentence.
    expect(
      positionSentence(period(), "2028-12-02", {
        applicationInsideWindow: true,
      }),
    ).toBe(
      "Your renewal window is open. Apply by 1 December 2028 (our suggestion).",
    );
    expect(positionSentence(period(), "2029-03-02")).toBe(
      "Your registration period ended on 1 March 2029. If your application was with the Commission in the six months before then, your registration continues until the decision (NDIS Act s 73K). Enter the dates from your new certificate here when it arrives.",
    );
  });

  it("an edited period end moves every renewal date", () => {
    const rows = byId(timelineRows(period({ period_ends_on: "2029-06-01" })));
    expect(rows["renewal-window"].date).toBe("2028-12-01");
    expect(rows["renewal-apply-by"].date).toBe("2029-03-01");
    expect(rows["period-end"].date).toBe("2029-06-01");
  });

  it("leap years and month ends clamp the way the calendar does", () => {
    expect(addMonths("2028-02-29", 12)).toBe("2029-02-28");
    expect(addMonths("2026-08-31", -6)).toBe("2026-02-28");
    const rows = byId(timelineRows(period({ period_starts_on: "2026-08-31" })));
    expect(rows["midterm-prepare"].date).toBe("2027-08-31");
    expect(rows["midterm-start-by"].date).toBe("2028-02-29");
    expect(monthsBetween("2026-03-01", "2026-10-15")).toBe(7);
    expect(monthsBetween("2026-03-15", "2026-10-14")).toBe(6);
    expect(monthsBetween("2026-10-15", "2026-10-14")).toBe(0);
    expect(formatLongDate("2029-03-01")).toBe("1 March 2029");
  });

  // REQ-023 Session D (FR-2, AC-6; findings 47 and 86).
  it("adds the change-of-ownership audit row for a certification provider, three months after the change, with the Rules' source word", () => {
    const rows = timelineRows(period(), { ownershipChangeOn: "2027-06-01" });
    expect(rows.map((r) => r.id)).toEqual([
      "midterm-prepare",
      "midterm-start-by",
      "ownership-audit-start-by",
      "renewal-window",
      "renewal-apply-by",
      "period-end",
    ]);
    const row = byId(rows)["ownership-audit-start-by"];
    expect(row.date).toBe("2027-09-01");
    expect(row.source).toBe("Rules s 13BA");
    expect(row.label).toBe("Change-of-ownership audit must start by");
    expect(row.legal).toBe(true);
    // D-2320: the row says how "under way" is read and what clears it.
    expect(row.plain).toContain(
      "record its date on the account page and this row goes",
    );
    expect(legalRows(rows).map((r) => r.id)).toContain(
      "ownership-audit-start-by",
    );
    expect(ownershipAuditStartBy(period(), "2027-06-01")).toBe("2027-09-01");
  });

  it("holds the row back for a verification provider, with no change recorded, when the registration ends inside the three months, or when a mid-term audit is under way", () => {
    expect(ownershipAuditStartBy(period(), null)).toBeNull();
    expect(
      ownershipAuditStartBy(
        period({ audit_type: "verification", midterm_applies: false }),
        "2027-06-01",
      ),
    ).toBeNull();
    // The period ends 1 March 2029; a change on 1 January 2029 would need an audit by 1 April 2029.
    expect(ownershipAuditStartBy(period(), "2029-01-01")).toBeNull();
    expect(ownershipAuditStartBy(period(), "2028-12-01")).toBe("2029-03-01");
    // A mid-term audit that started inside the three months after the change is under way.
    expect(
      ownershipAuditStartBy(
        period({ midterm_audit_on: "2027-07-15" }),
        "2027-06-01",
      ),
    ).toBeNull();
    expect(
      ownershipAuditStartBy(
        period({ midterm_audit_on: "2027-04-15" }),
        "2027-06-01",
      ),
    ).toBe("2027-09-01");
    expect(
      timelineRows(period(), { ownershipChangeOn: null }).map((r) => r.id),
    ).not.toContain("ownership-audit-start-by");
  });
});

describe("midtermFor (findings 45, 71, 78)", () => {
  const applies: MidTermAudit = {
    applies: true,
    monthsAfterRegistration: 18,
    prepareFromMonth: 12,
    assessedDivisionIds: ["governance"],
    sourceId: "types-of-audits",
  };
  it("a verification type never has one, whatever the questionnaire says", () => {
    expect(midtermFor("verification", applies)).toEqual({
      applies: false,
      reason: "a verification audit has no mid-term audit (Rules s 13B(1))",
    });
  });
  it("a certification type follows the questionnaire's s 13B(7) reading", () => {
    expect(midtermFor("certification", applies)).toEqual({
      applies: true,
      reason: null,
    });
    expect(
      midtermFor("certification", {
        ...applies,
        applies: false,
        exemptReason:
          "a provider that is only registered to provide specialist disability accommodation",
      }),
    ).toEqual({
      applies: false,
      reason:
        "a provider that is only registered to provide specialist disability accommodation (Rules s 13B(7))",
    });
  });
});

describe("the five reminders (FR-3, AC-2)", () => {
  it("produce the five send dates for the fixture, each about its own date", () => {
    expect(registrationReminders({ period: period() })).toEqual([
      { kind: "midterm-prepare", due_on: "2027-09-01", send_on: "2027-03-01" },
      { kind: "midterm-start-by", due_on: "2027-09-01", send_on: "2027-08-04" },
      { kind: "renewal-window", due_on: "2029-03-01", send_on: "2028-09-01" },
      { kind: "renewal-apply-by", due_on: "2028-12-01", send_on: "2028-11-03" },
      {
        kind: "renewal-last-call",
        due_on: "2029-03-01",
        send_on: "2029-02-15",
      },
    ]);
    expect(REGISTRATION_REMINDER_KINDS).toHaveLength(5);
  });
  it("the once rule: a kind sent in this period is never sent again on a new date", () => {
    const edited = period({ period_ends_on: "2029-06-01" });
    const kinds = registrationReminders({
      period: edited,
      sentKinds: ["renewal-window", "midterm-prepare"],
    }).map((r) => r.kind);
    expect(kinds).toEqual([
      "midterm-start-by",
      "renewal-apply-by",
      "renewal-last-call",
    ]);
  });
  it("no mid-term kinds without a mid-term audit, or once it is done", () => {
    expect(
      registrationReminders({
        period: period({ audit_type: "verification", midterm_applies: false }),
      }).map((r) => r.kind),
    ).toEqual(["renewal-window", "renewal-apply-by", "renewal-last-call"]);
    expect(
      registrationReminders({
        period: period({ midterm_audit_on: "2027-08-20" }),
      }).map((r) => r.kind),
    ).toEqual(["renewal-window", "renewal-apply-by", "renewal-last-call"]);
  });
  it("the override moves the start-by reminder; a cancellation stops them all; the last call has its two exceptions", () => {
    const override = period({
      midterm_start_by_override: "2027-12-01",
      midterm_override_source: "letter",
    });
    expect(
      registrationReminders({ period: override }).find(
        (r) => r.kind === "midterm-start-by",
      ),
    ).toEqual({
      kind: "midterm-start-by",
      due_on: "2027-12-01",
      send_on: "2027-11-03",
    });
    expect(
      registrationReminders({ period: period(), subscriptionCancelled: true }),
    ).toEqual([]);
    for (const opts of [
      { applicationInsideWindow: true },
      { endChangedInsideWindow: true },
    ])
      expect(
        registrationReminders({ period: period(), ...opts }).map((r) => r.kind),
      ).not.toContain("renewal-last-call");
  });
  it("every line names the date and the source and nothing about the registers (SR-4)", () => {
    for (const kind of REGISTRATION_REMINDER_KINDS) {
      const line = registrationReminderLine(kind, "2029-03-01");
      expect(line).toContain("1 March 2029");
      expect(line).toMatch(/Rules s 13B|NDIS Act s 73K|our suggestion/);
      expect(line).not.toMatch(/incident|complaint|participant/i);
    }
  });
});
