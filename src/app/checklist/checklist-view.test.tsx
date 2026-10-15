/**
 * Retro review of REQ-015 (finding 23), CLAUDE.md 4.5: the checklist note
 * runs the participant-data detector as it is typed, warns under the field
 * with the registers' words, and never blocks the note.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ShownChecklist, ShownItem } from "@/lib/checklist/state";
import { ChecklistView } from "./checklist-view";

vi.mock("@/server/checklist/actions", () => ({
  saveChecklistItemAction: vi.fn(async () => ({ ok: true })),
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const item: ShownItem = {
  id: "business:abn",
  group: "business",
  title: "Have your ABN ready",
  ask: "What is your ABN?",
  why: "Every registered provider needs one.",
  sourceRef: { kind: "content", title: "Readyline guidance" },
  unverified: false,
  initialStatus: "need",
  status: "need",
  note: "",
  stored: false,
} as ShownItem;

const shown: ShownChecklist = {
  groups: [
    {
      id: "business",
      title: "Your business",
      items: [item],
      ready: 0,
      open: true,
    },
  ],
  items: [item],
  ready: 0,
  total: 1,
} as ShownChecklist;

describe("the checklist note field", () => {
  it("warns when the note looks like a participant's name and number, and keeps the note", () => {
    render(
      <ChecklistView
        tradingName="Example Supports"
        pathway="verification"
        shown={shown}
        setId={null}
      />,
    );
    fireEvent.click(screen.getByTestId("checklist-row-business-abn"));
    fireEvent.click(screen.getByTestId("add-note-business-abn"));
    const note = screen.getByLabelText("Note") as HTMLTextAreaElement;
    expect(screen.queryByTestId("business-abn-participant-warning")).toBeNull();

    fireEvent.change(note, { target: { value: "Jane Smith 430123456" } });
    const warning = screen.getByTestId("business-abn-participant-warning");
    expect(warning).toHaveAttribute("role", "status");
    expect(warning).toHaveTextContent(
      "This looks like it contains a person's name. Use a reference code such as P-014 instead of naming a participant.",
    );
    expect(warning).toHaveTextContent(
      "This looks like an NDIS participant number. Do not enter participant numbers.",
    );
    // Warn, never block: the note keeps what was typed and is described by the warning.
    expect(note.value).toBe("Jane Smith 430123456");
    expect(note.getAttribute("aria-describedby")).toContain(
      "business-abn-participant-warning",
    );

    fireEvent.change(note, { target: { value: "Ask P-014's coordinator" } });
    expect(screen.queryByTestId("business-abn-participant-warning")).toBeNull();
  });
});
