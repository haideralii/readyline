import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RegisterTable } from "./register-table";
import type { TableColumn } from "@/lib/registers/table-columns";

/**
 * REQ-028 FR-8: the table renders the columns in order, the first column as
 * the row's link, the status as the one Tag where the column sits, the
 * empty word for a null cell, and nothing else.
 */
afterEach(cleanup);

const COLUMNS: TableColumn[] = [
  { label: "Ref", kind: "code", empty: "—" },
  { label: "Received", kind: "date", empty: "—" },
  { label: "Acknowledged", kind: "date", empty: "Not yet" },
  { label: "Status", kind: "status", empty: "—" },
];

const ROWS = [
  {
    id: "a",
    href: "/registers/complaints/a",
    title: "CMP-0001: a title",
    status: { key: "open", label: "Open", tone: "ochre" as const },
    cells: ["CMP-0001", "17 Oct 2026", null, null],
  },
  {
    id: "b",
    href: "/registers/complaints/b",
    title: "CMP-0002: another",
    status: { key: "resolved", label: "Resolved", tone: "moss" as const },
    cells: [null, "18 Oct 2026", "19 Oct 2026", null],
  },
];

describe("RegisterTable", () => {
  it("renders the headers in order, the first cell as the link and the status tag in its column", () => {
    render(<RegisterTable columns={COLUMNS} rows={ROWS} testId="t" />);
    expect(
      screen.getAllByRole("columnheader").map((th) => th.textContent),
    ).toEqual(["Ref", "Received", "Acknowledged", "Status"]);
    const first = screen.getByTestId("trow-a");
    const link = first.querySelector("a")!;
    expect(link.getAttribute("href")).toBe("/registers/complaints/a");
    expect(link.textContent).toBe("CMP-0001");
    // The accessible name is the row's title, the visible cell inside it (PO 18:10).
    expect(link.getAttribute("aria-label")).toBe("CMP-0001: a title");
    const tag = first.querySelector('[data-testid="status-tag"]')!;
    expect(tag.getAttribute("data-status")).toBe("open");
    expect(tag.textContent).toContain("Open");
    // The status tag sits in the fourth column.
    expect(first.querySelectorAll("td")[3].contains(tag)).toBe(true);
  });

  it("shows the empty word for a null cell and falls back to the title in the link", () => {
    render(<RegisterTable columns={COLUMNS} rows={ROWS} testId="t" />);
    const cellsA = screen.getByTestId("trow-a").querySelectorAll("td");
    expect(cellsA[2].textContent).toBe("Not yet");
    // Whole class tokens, never a glued fragment (D-2274 (5)).
    expect(cellsA[2].className.split(" ")).toContain("text-slate");
    const cellsB = screen.getByTestId("trow-b").querySelectorAll("td");
    expect(cellsB[0].querySelector("a")!.textContent).toBe("CMP-0002: another");
    // When the link already shows the title, no aria-label repeats it.
    expect(cellsB[0].querySelector("a")!.getAttribute("aria-label")).toBeNull();
    expect(cellsB[1].className.split(" ")).toContain("tabular-nums");
    expect(cellsB[1].className.split(" ")).not.toContain("text-slate");
  });

  it("is named by the register's heading and hidden under sm", () => {
    render(<RegisterTable columns={COLUMNS} rows={ROWS} testId="t" />);
    const region = screen.getByTestId("t");
    expect(region.getAttribute("role")).toBe("region");
    expect(region.getAttribute("aria-labelledby")).toBe("register-title");
    expect(region.className).toContain("hidden");
    expect(region.className).toContain("sm:block");
  });
});
