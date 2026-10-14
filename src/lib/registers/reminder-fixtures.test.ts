// @vitest-environment node
/**
 * Backlog 4 (REQ-018 AC-3, REQ-009 AC-4): one recorded fixture per reminder
 * kind under fixtures/reminders, each with fixed dates around a fixed
 * "today" and the exact rows the pure `dueReminders` must produce. A new
 * kind in REMINDER_KINDS without a fixture fails here, so does a fixture
 * for a kind that no longer exists, and so does any drift in the offsets.
 * The integration test seeds the same dates into a real stack.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  dueReminders,
  type ReminderDue,
  type ReminderInput,
} from "./reminders";
import { REMINDER_KINDS } from "./types";

const DIR = join(process.cwd(), "fixtures", "reminders");

type Fixture = {
  kind: string;
  today: string;
  note: string;
  input: Omit<ReminderInput, "today">;
  expected: ReminderDue[];
};

const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));
const fixtures = files.map(
  (f) => JSON.parse(readFileSync(join(DIR, f), "utf8")) as Fixture,
);

describe("reminder fixtures (backlog 4)", () => {
  it("has exactly one fixture per reminder kind, named after it", () => {
    expect(files.map((f) => f.replace(/\.json$/, "")).sort()).toEqual(
      [...REMINDER_KINDS].sort(),
    );
    for (const [i, f] of fixtures.entries())
      expect(f.kind, files[i]).toBe(files[i].replace(/\.json$/, ""));
  });

  it.each(fixtures.map((f) => [f.kind, f] as const))(
    "%s: the fixed dates produce exactly the recorded rows",
    (kind, f) => {
      expect(f.note.length).toBeGreaterThan(20);
      expect(/^\d{4}-\d{2}-\d{2}$/.test(f.today)).toBe(true);
      const rows = dueReminders({ ...f.input, today: f.today });
      expect(rows).toEqual(f.expected);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.kind === kind)).toBe(true);
      // Every fixture fires inside the catch-up window: on the day or within a week after.
      for (const r of rows) {
        const behind =
          (Date.parse(f.today) - Date.parse(r.send_on)) / 86_400_000;
        expect(behind, `${kind} send_on`).toBeGreaterThanOrEqual(0);
        expect(behind, `${kind} send_on`).toBeLessThanOrEqual(7);
      }
    },
  );
});
