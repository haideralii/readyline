import { describe, expect, it } from "vitest";
import { dueSoonLines } from "./due-soon";

const base = {
  today: "2026-10-14",
  days: 30,
  incidents: [],
  clearances: [],
  policyReviews: [],
  stored: [],
};

describe("due soon on the account page (batch 45 item 5)", () => {
  it("puts an open reportable incident's notify-by first, before everything else", () => {
    const lines = dueSoonLines({
      ...base,
      incidents: [
        {
          id: "i1",
          reference: "INC-0001",
          reportable: true,
          notify_by: "2026-10-16",
          reportable_notified_on: null,
          status: "open",
        },
      ],
      clearances: [
        {
          id: "c1",
          worker_ref: "W-01",
          role_label: "Support worker",
          expires_on: "2026-10-15",
        },
      ],
      policyReviews: [
        { id: "p1", title: "Governance policy", next_review_on: "2026-10-15" },
      ],
      stored: [
        {
          id: "r1",
          kind: "renewal",
          line: "Your registration renewal is due on 2026-11-01.",
          dueOn: "2026-11-01",
          sent: true,
        },
      ],
    });
    expect(lines.map((l) => l.line)).toEqual([
      "Notify the Commission about incident INC-0001 by 2026-10-16.",
      "Worker check for W-01 (Support worker) expires on 2026-10-15.",
      "Policy Governance policy is due for review on 2026-10-15.",
      "Your registration renewal is due on 2026-11-01.",
    ]);
    expect(lines[3].sent).toBe(true);
  });

  it("leaves out what is outside the window, notified, closed or not reportable", () => {
    const lines = dueSoonLines({
      ...base,
      incidents: [
        {
          id: "a",
          reference: "INC-0002",
          reportable: true,
          notify_by: "2026-12-01",
          reportable_notified_on: null,
          status: "open",
        },
        {
          id: "b",
          reference: "INC-0003",
          reportable: true,
          notify_by: "2026-10-15",
          reportable_notified_on: "2026-10-14",
          status: "open",
        },
        {
          id: "c",
          reference: "INC-0004",
          reportable: false,
          notify_by: null,
          reportable_notified_on: null,
          status: "open",
        },
        {
          id: "d",
          reference: "INC-0005",
          reportable: true,
          notify_by: "2026-10-15",
          reportable_notified_on: null,
          status: "closed",
        },
      ],
      clearances: [
        { id: "x", worker_ref: "W-02", role_label: "Owner", expires_on: null },
        {
          id: "y",
          worker_ref: "W-03",
          role_label: "Owner",
          expires_on: "2027-01-01",
        },
      ],
      policyReviews: [{ id: "p", title: "Privacy", next_review_on: null }],
    });
    expect(lines).toEqual([]);
  });

  it("keeps an overdue notify-by listed and drops stored rows the live rows already cover", () => {
    const lines = dueSoonLines({
      ...base,
      incidents: [
        {
          id: "i",
          reference: "INC-0009",
          reportable: true,
          notify_by: "2026-10-01",
          reportable_notified_on: null,
          status: "under-review",
        },
      ],
      stored: [
        {
          id: "s1",
          kind: "clearance-expiry",
          line: "Worker check W-01 expires on 2026-10-20.",
          dueOn: "2026-10-20",
          sent: false,
        },
        {
          id: "s2",
          kind: "mid-term-audit",
          line: "Your mid-term audit is due on 2027-04-01.",
          dueOn: "2027-04-01",
          sent: false,
        },
      ],
    });
    expect(lines.map((l) => l.line)).toEqual([
      "Notify the Commission about incident INC-0009 by 2026-10-01.",
      "Your mid-term audit is due on 2027-04-01.",
    ]);
  });
});
