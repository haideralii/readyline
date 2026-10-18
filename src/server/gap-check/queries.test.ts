// @vitest-environment node
/**
 * REQ-035 FR-5: the newest check per type, the audit-day summary and the
 * Sydney day, over rows as the database returns them (newest first).
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { gapCheckDay, gapCheckSummary, latestPerType } =
  await import("./queries");

const row = (
  id: string,
  type: string,
  partly: number,
  missing: number,
  createdAt: string,
) => ({
  id,
  account_id: "acc-1",
  document_type_id: type,
  title: id,
  covered: 1,
  partly,
  missing,
  prompt_version: "gap-check-1",
  created_by: "u",
  created_at: createdAt,
});

describe("the gap checks' queries (REQ-035 FR-5)", () => {
  const rows = [
    row("c3", "complaints", 1, 2, "2026-10-19T03:00:00Z"),
    row("c2", "incidents", 0, 5, "2026-10-18T13:00:00Z"),
    row("c1", "complaints", 2, 6, "2026-10-18T12:00:00Z"),
  ];

  it("keeps the newest check per type, in the order the rows came", () => {
    expect(latestPerType(rows).map((r) => r.id)).toEqual(["c3", "c2"]);
  });

  it("counts the policies checked and the sections the newest checks leave to close", () => {
    expect(gapCheckSummary(rows)).toEqual({ checked: 2, toClose: 8 });
    expect(gapCheckSummary([])).toEqual({ checked: 0, toClose: 0 });
  });

  it("writes the run's day in Sydney", () => {
    // 13:30 UTC on 18 October is the 19th in Sydney (AEDT, +11).
    expect(gapCheckDay("2026-10-18T13:30:00Z")).toBe("19 October 2026");
    expect(gapCheckDay("2026-10-18T12:30:00Z")).toBe("18 October 2026");
  });
});
