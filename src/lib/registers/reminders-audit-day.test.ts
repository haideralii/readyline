import { describe, expect, it } from "vitest";
import {
  APPRAISAL_EVERY_DAYS,
  DRILL_EVERY_MONTHS,
  INSURANCE_OFFSETS,
  REGISTER_REVIEW_OFFSETS,
  SUPERVISION_EVERY_DAYS,
  SUPPORT_PLAN_OFFSETS,
  addMonths,
  dueReminders,
  reminderLine,
  type ReminderInput,
} from "./reminders";
import { addDays } from "./status";
import { REMINDER_KINDS } from "./types";

/**
 * REQ-018 Session C (FR-5, FR-8, FR-10, AC-3; D-1905): the six new reminder
 * kinds with fixed dates: insurance and vehicle expiries 30 and 7 days
 * before and on the day; supervision 31 days after the last; appraisal 365
 * days after the last, with a 30-day warning; the support plan review 30
 * and 7 days before and on the day; a register row's review 14 days before
 * and on the day; the emergency drill six months after the last, with a
 * 14-day warning. Every kind has a line that names the register and the
 * reference only.
 */
const TODAY = "2026-10-13";

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
const firesToday = (r: ReturnType<typeof dueReminders>, dueOn: string) =>
  r.some((x) => x.send_on === TODAY && x.due_on === dueOn);

describe("audit-day reminders (REQ-018 Session C)", () => {
  it.each([...INSURANCE_OFFSETS])(
    "an insurance or vehicle item %i days before expiry fires today",
    (days) => {
      const expiresOn = addDays(TODAY, days);
      const r = dueReminders(
        base({ insuranceItems: [{ id: "ins1", expires_on: expiresOn }] }),
      );
      expect(firesToday(r, expiresOn)).toBe(true);
      expect(r[0]).toMatchObject({
        kind: "insurance-expiry",
        subject_table: "insurance_items",
        subject_id: "ins1",
      });
    },
  );

  it("supervision is due 31 days after the last one; appraisal 365 days after, with a 30-day warning", () => {
    const sup = addDays(TODAY, -SUPERVISION_EVERY_DAYS);
    const app = addDays(TODAY, -APPRAISAL_EVERY_DAYS);
    const r = dueReminders(
      base({
        staff: [{ id: "s1", last_supervision_on: sup, last_appraisal_on: app }],
      }),
    );
    expect(kinds(r).sort()).toEqual(
      [`supervision-due@${TODAY}`, `appraisal-due@${TODAY}`].sort(),
    );
    const warn = dueReminders(
      base({
        staff: [
          {
            id: "s1",
            last_supervision_on: null,
            last_appraisal_on: addDays(TODAY, -(APPRAISAL_EVERY_DAYS - 30)),
          },
        ],
      }),
    );
    expect(kinds(warn)).toEqual([`appraisal-due@${TODAY}`]);
    expect(warn[0].due_on).toBe(addDays(TODAY, 30));
    // No dates, nothing to remind: the page shows the gap instead.
    expect(
      dueReminders(
        base({
          staff: [
            { id: "s2", last_supervision_on: null, last_appraisal_on: null },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it.each([...SUPPORT_PLAN_OFFSETS])(
    "a support plan review %i days away fires today",
    (days) => {
      const reviewOn = addDays(TODAY, days);
      const r = dueReminders(
        base({
          participantRisks: [{ id: "p1", support_plan_review_on: reviewOn }],
        }),
      );
      expect(firesToday(r, reviewOn)).toBe(true);
      expect(r[0]).toMatchObject({
        kind: "support-plan-review",
        subject_table: "participant_risks",
      });
    },
  );

  it.each([...REGISTER_REVIEW_OFFSETS])(
    "a register row's review %i days away fires today, pointing at its own table",
    (days) => {
      const reviewOn = addDays(TODAY, days);
      const r = dueReminders(
        base({
          reviewRows: [
            { id: "c1", table: "conflicts_of_interest", review_on: reviewOn },
          ],
        }),
      );
      expect(firesToday(r, reviewOn)).toBe(true);
      expect(r[0]).toMatchObject({
        kind: "register-review",
        subject_table: "conflicts_of_interest",
        subject_id: "c1",
      });
    },
  );

  it("the emergency drill is due six months after the last, with a 14-day warning", () => {
    const last = addMonths(TODAY, -DRILL_EVERY_MONTHS);
    const r = dueReminders(base({ lastEmergencyDrillOn: last }));
    expect(kinds(r)).toEqual([`emergency-drill@${TODAY}`]);
    expect(r[0]).toMatchObject({
      subject_table: "accounts",
      subject_id: "acc",
    });
    // A drill six months less 14 days ago: the due date is 14 days away and the warning fires today.
    const warn = dueReminders(
      base({
        lastEmergencyDrillOn: addDays(
          addMonths(TODAY, -DRILL_EVERY_MONTHS),
          14,
        ),
      }),
    );
    expect(kinds(warn)).toEqual([`emergency-drill@${TODAY}`]);
    expect(warn[0].due_on).toBe(addDays(TODAY, 14));
    expect(dueReminders(base({ lastEmergencyDrillOn: null }))).toEqual([]);
  });

  it("every reminder kind has a line that names a register or a reference, never content", () => {
    for (const kind of REMINDER_KINDS) {
      const line = reminderLine(kind, "REF-1", "2026-11-01");
      expect(line.length, kind).toBeGreaterThan(20);
      expect(line, kind).toMatch(/REF-1|2026-11-01|audit|drill|registration/);
    }
    expect(
      reminderLine("insurance-expiry", "Insurer A", "2026-11-01"),
    ).toContain("insurances register");
    expect(reminderLine("register-review", "C-1", "2026-11-01")).toContain(
      "Reviewed today",
    );
  });
});
