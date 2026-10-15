import { describe, expect, it } from "vitest";
import {
  ComplaintForm,
  IncidentForm,
  PolicyReviewForm,
  WorkerCheckForm,
  suggestedExpiry,
} from "./forms";

const incident = {
  occurredOn: "2026-10-09",
  reportedOn: "2026-10-09",
  category: "near-miss",
  severity: "low",
  participantRef: "p-014",
  workerRef: "",
  summary: "Near miss in the kitchen; no harm.",
  actionsTaken: "",
  reportable: false,
  reportableNotifiedOn: "",
  status: "open",
  closedOn: "",
};

describe("register forms (REQ-009 FR-5, SR-1)", () => {
  it("accepts a plain incident and upper-cases the reference codes", () => {
    const r = IncidentForm.safeParse(incident);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.participantRef).toBe("P-014");
      expect(r.data.workerRef).toBeNull();
      expect(r.data.closedOn).toBeNull();
    }
  });

  it("refuses a name in a reference field, an NDIS number in free text and an unknown key", () => {
    expect(
      IncidentForm.safeParse({ ...incident, participantRef: "Jane Citizen" })
        .success,
    ).toBe(false);
    const ndis = IncidentForm.safeParse({
      ...incident,
      summary: "Participant 430123456 fell.",
    });
    expect(ndis.success).toBe(false);
    if (!ndis.success)
      expect(ndis.error.issues[0].message).toMatch(/NDIS participant number/);
    expect(
      IncidentForm.safeParse({ ...incident, participantName: "x" }).success,
    ).toBe(false);
  });

  it("keeps the dates and the status consistent", () => {
    expect(
      IncidentForm.safeParse({ ...incident, reportedOn: "2026-10-08" }).success,
    ).toBe(false);
    expect(
      IncidentForm.safeParse({ ...incident, status: "closed" }).success,
    ).toBe(false);
    expect(
      IncidentForm.safeParse({
        ...incident,
        status: "closed",
        closedOn: "2026-10-12",
      }).success,
    ).toBe(true);
    expect(
      IncidentForm.safeParse({
        ...incident,
        reportableNotifiedOn: "2026-10-10",
      }).success,
    ).toBe(false);
    expect(
      IncidentForm.safeParse({
        ...incident,
        reportable: true,
        reportableNotifiedOn: "2026-10-10",
      }).success,
    ).toBe(true);
  });

  it("complaints: the five from-code prefixes, resolved needs a date", () => {
    const base = {
      receivedOn: "2026-10-12",
      channel: "phone",
      fromRef: "fam-2",
      summary: "Worker arrived late twice.",
      outcome: "",
      acknowledgedOn: "",
      resolvedOn: "",
      status: "received",
    };
    const ok = ComplaintForm.safeParse(base);
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.fromRef).toBe("FAM-2");
    expect(ComplaintForm.safeParse({ ...base, fromRef: "X-2" }).success).toBe(
      false,
    );
    expect(
      ComplaintForm.safeParse({ ...base, status: "resolved" }).success,
    ).toBe(false);
    expect(
      ComplaintForm.safeParse({ ...base, acknowledgedOn: "2026-10-11" })
        .success,
    ).toBe(false);
  });

  it("worker checks: role never a person, expiry after issue, suggested expiry by kind", () => {
    const base = {
      workerRef: "W-3",
      roleLabel: "support worker",
      clearanceKind: "wwcc",
      issuedOn: "2025-01-01",
      expiresOn: "2030-01-01",
      state: "NSW",
      note: "",
    };
    expect(WorkerCheckForm.safeParse(base).success).toBe(true);
    expect(
      WorkerCheckForm.safeParse({ ...base, expiresOn: "2024-01-01" }).success,
    ).toBe(false);
    expect(
      WorkerCheckForm.safeParse({ ...base, workerRef: "Jane" }).success,
    ).toBe(false);
    expect(suggestedExpiry("ndis-worker-screening", "2026-02-28")).toBe(
      "2031-02-28",
    );
    expect(
      suggestedExpiry("ndis-worker-orientation-module", "2026-02-28"),
    ).toBeNull();
    expect(suggestedExpiry("wwcc", "2026-02-28")).toBeNull();
  });

  it("policy reviews: other needs a title, cycle within 1 to 36 months", () => {
    const base = {
      documentTypeId: "complaints-management-policy-and-register",
      title: "",
      adoptedOn: "2026-01-15",
      reviewCycleMonths: "12",
      lastReviewedOn: "",
      reviewerRef: "",
      note: "",
    };
    const ok = PolicyReviewForm.safeParse(base);
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.reviewCycleMonths).toBe(12);
    expect(
      PolicyReviewForm.safeParse({ ...base, documentTypeId: "other" }).success,
    ).toBe(false);
    expect(
      PolicyReviewForm.safeParse({
        ...base,
        documentTypeId: "other",
        title: "Fire plan",
      }).success,
    ).toBe(true);
    expect(
      PolicyReviewForm.safeParse({ ...base, reviewCycleMonths: "40" }).success,
    ).toBe(false);
  });
});

describe("the Commission reference on an incident (batch 45, REQ-018-gated item)", () => {
  it("is optional, needs reportable, takes letters and digits only, and never a participant number", () => {
    expect(
      IncidentForm.safeParse({
        ...incident,
        commissionReference: "REF-2026/14",
      }).success,
    ).toBe(false);
    const ok = IncidentForm.safeParse({
      ...incident,
      reportable: true,
      commissionReference: " REF-2026/14 ",
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.commissionReference).toBe("REF-2026/14");
    expect(
      IncidentForm.safeParse({
        ...incident,
        reportable: true,
        commissionReference: "ref #14",
      }).success,
    ).toBe(false);
    expect(
      IncidentForm.safeParse({
        ...incident,
        reportable: true,
        commissionReference: "430123456",
      }).success,
    ).toBe(false);
    const none = IncidentForm.safeParse(incident);
    expect(none.success).toBe(true);
    if (none.success) expect(none.data.commissionReference).toBe("");
  });
});
