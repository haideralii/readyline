import { describe, expect, it } from "vitest";
import {
  addMonths,
  CATCH_UP_DAYS,
  dueReminders,
  inWindow,
  reminderLine,
  type ReminderInput,
} from "./reminders";
import { addDays } from "./status";

const TODAY = "2026-10-13"; // a Tuesday

function base(over: Partial<ReminderInput> = {}): ReminderInput {
  return {
    today: TODAY,
    account: { id: "acc" },
    incidents: [],
    complaints: [],
    workerChecks: [],
    policyReviews: [],
    ...over,
  };
}

const kinds = (r: ReturnType<typeof dueReminders>) =>
  r.map((x) => `${x.kind}@${x.send_on}`);
/** True when one of the reminders is dated today for the given due date. */
const firesToday = (r: ReturnType<typeof dueReminders>, dueOn: string) =>
  r.some((x) => x.send_on === TODAY && x.due_on === dueOn);

describe("reminder rules (REQ-009 FR-3)", () => {
  it("nothing to remind on an empty account", () => {
    expect(dueReminders(base())).toEqual([]);
  });

  describe("worker checks: 90, 30, 7 days before and on the day", () => {
    it.each([90, 30, 7, 0])("%i days before expiry fires today", (days) => {
      const expiresOn = addDays(TODAY, days);
      const r = dueReminders(
        base({ workerChecks: [{ id: "w1", expires_on: expiresOn }] }),
      );
      expect(firesToday(r, expiresOn)).toBe(true);
      expect(r[0]).toMatchObject({
        kind: "clearance-expiry",
        subject_table: "worker_clearances",
        subject_id: "w1",
      });
    });
    it("on the day, the 7-day reminder is also inside the catch-up window (two dates, one key each)", () => {
      const r = dueReminders(
        base({ workerChecks: [{ id: "w1", expires_on: TODAY }] }),
      );
      expect(kinds(r).sort()).toEqual(
        [
          `clearance-expiry@${addDays(TODAY, -7)}`,
          `clearance-expiry@${TODAY}`,
        ].sort(),
      );
    });
    it.each([98, 91, 31, 15, 8])(
      "%i days before expiry: no reminder date falls in the window",
      (days) => {
        expect(
          dueReminders(
            base({
              workerChecks: [{ id: "w1", expires_on: addDays(TODAY, days) }],
            }),
          ),
        ).toEqual([]);
      },
    );
    it("a check with no expiry never reminds", () => {
      expect(
        dueReminders(base({ workerChecks: [{ id: "w1", expires_on: null }] })),
      ).toEqual([]);
    });
  });

  describe("policy reviews: 60 and 14 days before and on the day", () => {
    it.each([60, 14, 0])("%i days before fires today", (days) => {
      const due = addDays(TODAY, days);
      const r = dueReminders(
        base({ policyReviews: [{ id: "p1", next_review_on: due }] }),
      );
      expect(firesToday(r, due)).toBe(true);
      expect(r[0].kind).toBe("policy-review");
    });
    it.each([68, 61, 22, 15, 1])(
      "%i days before: no reminder date falls in the window",
      (days) => {
        expect(
          dueReminders(
            base({
              policyReviews: [
                { id: "p1", next_review_on: addDays(TODAY, days) },
              ],
            }),
          ),
        ).toEqual([]);
      },
    );
    it("not adopted (no review date) never reminds", () => {
      expect(
        dueReminders(
          base({ policyReviews: [{ id: "p1", next_review_on: null }] }),
        ),
      ).toEqual([]);
    });
  });

  describe("incidents", () => {
    const incident = (over: Partial<ReminderInput["incidents"][number]>) => ({
      id: "i1",
      status: "open" as const,
      reportable: false,
      notify_by: null,
      reportable_notified_on: null,
      last_activity_on: addDays(TODAY, -30),
      ...over,
    });
    it("open with no event for 30 days", () => {
      const r = dueReminders(base({ incidents: [incident({})] }));
      expect(kinds(r)).toEqual([`incident-open@${TODAY}`]);
    });
    it("29 quiet days is too early; closed never reminds", () => {
      expect(
        dueReminders(
          base({
            incidents: [incident({ last_activity_on: addDays(TODAY, -29) })],
          }),
        ),
      ).toEqual([]);
      expect(
        dueReminders(base({ incidents: [incident({ status: "closed" })] })),
      ).toEqual([]);
    });
    // Retro finding 62 (D-2244): a rejected report still marked reportable
    // keeps its Commission clock and nothing else; one the owner has settled
    // as not reportable never reaches the rules (the job filters it).
    it("a rejected report still marked reportable raises the notification reminder only, never the quiet-30-days one", () => {
      const r = dueReminders(
        base({
          incidents: [
            incident({
              status: "rejected",
              reportable: true,
              notify_by: addDays(TODAY, -1),
            }),
          ],
        }),
      );
      expect(kinds(r)).toEqual([`reportable-not-notified@${TODAY}`]);
      expect(
        dueReminders(base({ incidents: [incident({ status: "rejected" })] })),
      ).toEqual([]);
    });
    it("reportable and not notified: the morning after notify_by", () => {
      const r = dueReminders(
        base({
          incidents: [
            incident({
              reportable: true,
              notify_by: addDays(TODAY, -1),
              last_activity_on: TODAY,
            }),
          ],
        }),
      );
      expect(kinds(r)).toEqual([`reportable-not-notified@${TODAY}`]);
      expect(r[0].due_on).toBe(addDays(TODAY, -1));
    });
    it("on notify_by itself it is not yet overdue; notified means silence", () => {
      expect(
        dueReminders(
          base({
            incidents: [
              incident({
                reportable: true,
                notify_by: TODAY,
                last_activity_on: TODAY,
              }),
            ],
          }),
        ),
      ).toEqual([]);
      expect(
        dueReminders(
          base({
            incidents: [
              incident({
                reportable: true,
                notify_by: addDays(TODAY, -1),
                reportable_notified_on: TODAY,
                last_activity_on: TODAY,
              }),
            ],
          }),
        ),
      ).toEqual([]);
    });
  });

  describe("complaints: 2 business days after receipt without acknowledgement", () => {
    it("received on Thursday fires on Monday (weekend skipped); on Tuesday it is in the window", () => {
      const r = dueReminders(
        base({
          complaints: [
            {
              id: "c1",
              status: "received",
              received_on: "2026-10-08",
              acknowledged_on: null,
            },
          ],
        }),
      );
      expect(r).toHaveLength(1);
      expect(r[0]).toMatchObject({
        kind: "complaint-unacknowledged",
        send_on: "2026-10-12",
        due_on: "2026-10-12",
      });
    });
    it("received yesterday is not due; acknowledged, resolved or withdrawn never remind", () => {
      expect(
        dueReminders(
          base({
            complaints: [
              {
                id: "c1",
                status: "received",
                received_on: addDays(TODAY, -1),
                acknowledged_on: null,
              },
            ],
          }),
        ),
      ).toEqual([]);
      expect(
        dueReminders(
          base({
            complaints: [
              {
                id: "c1",
                status: "acknowledged",
                received_on: "2026-10-01",
                acknowledged_on: "2026-10-02",
              },
            ],
          }),
        ),
      ).toEqual([]);
      expect(
        dueReminders(
          base({
            complaints: [
              {
                id: "c1",
                status: "withdrawn",
                received_on: "2026-10-01",
                acknowledged_on: null,
              },
            ],
          }),
        ),
      ).toEqual([]);
    });
  });

  describe("registration: the timeline kinds come from the period row (REQ-023 FR-3)", () => {
    const period = (starts: string, ends: string) => ({
      period: {
        id: "per-1",
        period_starts_on: starts,
        period_ends_on: ends,
        audit_type: "certification" as const,
        midterm_applies: true,
        midterm_exempt_reason: null,
        midterm_start_by_override: null,
        midterm_override_source: null,
        last_audit_on: null,
        midterm_audit_on: null,
      },
    });
    it("twelve months in, the prepare reminder goes out with the period as its subject", () => {
      const starts = addMonths(TODAY, -12);
      const r = dueReminders(
        base({ period: period(starts, addMonths(starts, 36)) }),
      );
      expect(kinds(r)).toEqual([`midterm-prepare@${TODAY}`]);
      expect(r[0].subject_table).toBe("registration_periods");
      expect(r[0].subject_id).toBe("per-1");
      expect(r[0].due_on).toBe(addMonths(starts, 18));
    });
    it("fourteen days before the period ends, the last call goes out, unless the subscription was cancelled", () => {
      const ends = addDays(TODAY, 14);
      const p = period(addMonths(ends, -36), ends);
      expect(kinds(dueReminders(base({ period: p })))).toEqual([
        `renewal-last-call@${TODAY}`,
      ]);
      expect(
        dueReminders(base({ period: { ...p, subscriptionCancelled: true } })),
      ).toEqual([]);
    });
    // REQ-023 FR-7 and FR-3 (finding 83; PO acceptance read, 18 Oct 2026 (3)): the last call reads the
    // application date on the period row through applicationInsideWindow, with nothing passed by the job.
    it("an application recorded inside the s 73K window stops the last call; one from before the window does not", () => {
      const ends = addDays(TODAY, 14);
      const p = period(addMonths(ends, -36), ends);
      const inside = {
        period: { ...p.period, application_submitted_on: addMonths(ends, -3) },
      };
      expect(kinds(dueReminders(base({ period: inside })))).toEqual([]);
      const outside = {
        period: { ...p.period, application_submitted_on: addMonths(ends, -9) },
      };
      expect(kinds(dueReminders(base({ period: outside })))).toEqual([
        `renewal-last-call@${TODAY}`,
      ]);
    });
    it("no period, no registration reminders", () => {
      expect(dueReminders(base({}))).toEqual([]);
    });
  });

  it("catch-up window: a reminder missed up to 7 days ago still goes, 8 days does not", () => {
    expect(inWindow(addDays(TODAY, -CATCH_UP_DAYS), TODAY)).toBe(true);
    expect(inWindow(addDays(TODAY, -CATCH_UP_DAYS - 1), TODAY)).toBe(false);
    expect(inWindow(addDays(TODAY, 1), TODAY)).toBe(false);
    const r = dueReminders(
      base({ workerChecks: [{ id: "w1", expires_on: addDays(TODAY, 2) }] }),
    );
    // Expiry in 2 days: the 7-day reminder (5 days ago) is still in the window; the day-of is not yet.
    expect(kinds(r)).toEqual([`clearance-expiry@${addDays(TODAY, -5)}`]);
  });

  describe("a report waiting for the owner (REQ-020 FR-5; PO review 14 Oct)", () => {
    const at = (hoursAgo: number) =>
      new Date(
        Date.parse(`${TODAY}T20:00:00Z`) - hoursAgo * 3_600_000,
      ).toISOString();
    it("nudges once a day from twelve hours after the report, dated today", () => {
      const r = dueReminders(
        base({
          now: `${TODAY}T20:00:00Z`,
          reports: [
            { id: "d1", aware_at: at(12) },
            { id: "d2", aware_at: at(30) },
          ],
        }),
      );
      expect(kinds(r)).toEqual([
        `report-to-confirm@${TODAY}`,
        `report-to-confirm@${TODAY}`,
      ]);
      expect(r.map((x) => x.subject_id)).toEqual(["d1", "d2"]);
      expect(r[0]).toMatchObject({ subject_table: "incidents", due_on: TODAY });
    });
    it("says nothing in the first twelve hours (the submission email covers them)", () => {
      const r = dueReminders(
        base({
          now: `${TODAY}T20:00:00Z`,
          reports: [{ id: "d1", aware_at: at(11.9) }],
        }),
      );
      expect(r).toEqual([]);
    });
    it("the line names the reference and both windows, nothing else (SR-4; retro finding 68)", () => {
      expect(reminderLine("report-to-confirm", "INC-0007", TODAY)).toBe(
        "Report INC-0007 is waiting for you to confirm. If it is reportable, the Commission must be told within 24 hours of the report for most kinds, or within 5 business days for an unauthorised restrictive practice that caused no harm.",
      );
    });
  });

  it("addMonths clamps to the month's end", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2026-10-13", 18)).toBe("2028-04-13");
  });

  it("the sentence names the register and the reference, nothing else (SR-4)", () => {
    expect(reminderLine("clearance-expiry", "W-003", "2026-12-01")).toBe(
      "Worker check W-003 expires on 2026-12-01.",
    );
    expect(
      reminderLine("reportable-not-notified", "INC-0004", "2026-10-16"),
    ).toMatch(/^Incident INC-0004 was due/);
    for (const k of [
      "policy-review",
      "incident-open",
      "complaint-unacknowledged",
      "midterm-prepare",
      "midterm-start-by",
      "renewal-window",
      "renewal-apply-by",
      "renewal-last-call",
    ] as const)
      expect(reminderLine(k, "X-1", "2027-01-01")).not.toMatch(
        /participant|summary/i,
      );
  });
});

describe("REQ-032 FR-2: the business-day windows skip the account's public holidays", () => {
  const received = (today: string, states?: readonly string[]) =>
    dueReminders({
      today,
      account: { id: "acc" },
      incidents: [],
      complaints: [
        {
          id: "c-easter",
          status: "open",
          received_on: "2026-04-02",
          acknowledged_on: null,
        },
      ],
      workerChecks: [],
      policyReviews: [],
      ...(states ? { states } : {}),
    }).find((r) => r.kind === "complaint-unacknowledged");

  it("a complaint received on Thursday 2 April 2026 is due Monday 6 April with no state, Wednesday 8 April for NSW (Good Friday and Easter Monday skipped)", () => {
    expect(received("2026-04-06")?.due_on).toBe("2026-04-06");
    expect(received("2026-04-06", ["NSW"])).toBeUndefined();
    expect(received("2026-04-08", ["NSW"])?.due_on).toBe("2026-04-08");
    expect(received("2026-04-08", ["NSW", "VIC"])?.due_on).toBe("2026-04-08");
  });
});
