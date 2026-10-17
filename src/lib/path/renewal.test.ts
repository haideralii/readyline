import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import type { RegistrationPeriod } from "@/lib/registers/timeline";
import {
  APPLY_LINES,
  RENEWAL_STEP_IDS,
  applicationWindowLine,
  renewalNext,
  renewalSteps,
} from "./renewal";

/**
 * REQ-023 Session C, AC-5: the certification fixture at the renewal window
 * with the dates confirmed, two documents due, no rehearsal and no
 * application reads the ten states the AC lists; a recorded application
 * inside or outside the s 73K window says which.
 */
const period: RegistrationPeriod = {
  id: "per-1",
  period_starts_on: "2026-03-01",
  period_ends_on: "2029-03-01",
  audit_type: "certification",
  midterm_applies: true,
  midterm_exempt_reason: null,
  midterm_start_by_override: null,
  midterm_override_source: null,
  last_audit_on: "2027-09-10",
  midterm_audit_on: "2027-09-10",
};

describe("the renewal path (FR-7, AC-5)", () => {
  it("reads the ten steps in the Commission's order with AC-5's states", () => {
    const steps = renewalSteps({
      period,
      documentsDue: 2,
      rehearsedOn: null,
      today: "2028-10-01",
    });
    expect(steps.map((s) => s.id)).toEqual([...RENEWAL_STEP_IDS]);
    expect(steps.map((s) => s.state)).toEqual([
      "done",
      "to read",
      "2 due",
      "not yet",
      "optional",
      "not yet",
      "not yet",
      "not yet",
      "not yet",
      "not yet",
    ]);
    expect(renewalNext(steps).id).toBe("what-changed");
    expect(steps[0].plain).toContain(
      "the renewal window opened 1 September 2028",
    );
    for (const s of steps) {
      expect(s.action.length).toBeGreaterThan(3);
      expect(
        findProhibitedClaims(
          `${s.title} ${s.state} ${s.action} ${s.plain ?? ""}`,
        ),
        s.id,
      ).toEqual([]);
    }
  });

  it("marks the dated steps done with their dates, the rehearsal with its day, and the documents with none due", () => {
    const steps = renewalSteps({
      period: {
        ...period,
        application_submitted_on: "2028-10-05",
        scope_received_on: "2028-10-12",
        audit_booked_on: "2028-11-01",
        auditor_business_name: "Example Certifiers Pty Ltd",
      },
      documentsDue: 0,
      rehearsedOn: "2028-09-20",
      today: "2028-11-10",
    });
    const byId = Object.fromEntries(steps.map((s) => [s.id, s]));
    expect(byId.documents.state).toBe("none due");
    expect(byId.rehearsal.state).toBe("done 20 September 2028");
    expect(byId.application.state).toBe("done 5 October 2028");
    expect(byId.scope.state).toBe("done 12 October 2028");
    expect(byId.booking.state).toBe("done 1 November 2028");
    expect(byId.booking.plain).toBe("With Example Certifiers Pty Ltd.");
    expect(renewalNext(steps).id).toBe("what-changed");
  });

  it("says whether a recorded application counts under s 73K (finding 83)", () => {
    expect(applicationWindowLine(period)).toBeNull();
    expect(
      applicationWindowLine({
        ...period,
        application_submitted_on: "2028-10-05",
      }),
    ).toContain(
      "inside the six months before your period ends (NDIS Act s 73K)",
    );
    expect(
      applicationWindowLine({
        ...period,
        application_submitted_on: "2028-08-01",
      }),
    ).toContain("outside the six months before your period ends");
  });

  it("asks for the dates first when there is no period, and carries the Commission's practice lines as the REQ quotes them", () => {
    const steps = renewalSteps({
      period: null,
      documentsDue: 0,
      rehearsedOn: null,
      today: "2028-10-01",
    });
    expect(steps[0].state).toBe("not yet");
    expect(renewalNext(steps).id).toBe("dates");
    expect(APPLY_LINES).toEqual([
      "The Commission emails your scope of audit after you apply.",
      "Lodge it under the same ABN; a new ABN is a new application (the Commission's renewal page).",
      "Finish the application within 60 days of starting it, or the portal deletes it (the Commission's apply page).",
    ]);
  });
});
