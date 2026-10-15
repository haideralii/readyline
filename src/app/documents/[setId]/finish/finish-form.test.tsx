/**
 * Retro review of REQ-017 (finding 68) and REQ-015 (finding 23), CLAUDE.md
 * 4.5: the Finish form's fact input runs the participant-data detector as
 * it is typed, warns under the field with the registers' words, and never
 * blocks the answer; the save sends the set id so the action can check the
 * key against the set's blanks (finding 67).
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { FactQuestion } from "@/lib/generator/facts-fill";
import { FinishForm } from "./finish-form";

const saveFactAction = vi.fn(async (_input: unknown) => ({
  ok: true as const,
}));
vi.mock("@/server/path/actions", () => ({
  saveFactAction: (input: unknown) => saveFactAction(input),
  finishPackAction: vi.fn(async () => ({ ok: true, blanksLeft: 0 })),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

beforeAll(() => {
  // jsdom has no matchMedia; the phone layout (one question per screen) is the default.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
});

const questions: FactQuestion[] = [
  {
    key: "location",
    blank: "[location]",
    question: "Where do you keep your records?",
    example: "For example a locked cabinet at home, or Google Drive.",
    topic: "business",
    kind: "text",
  },
];
const SET_ID = "2b1d1c7e-4f5a-4c1e-9a0e-5c6d7e8f9a0b";

describe("the Finish form's fact input", () => {
  it("warns when the answer looks like a participant's name and number, keeps the answer, and saves it with the set id", async () => {
    render(
      <FinishForm
        setId={SET_ID}
        questions={questions}
        initial={{}}
        documentCount={16}
      />,
    );
    const input = screen.getByLabelText(
      "Where do you keep your records?",
    ) as HTMLInputElement;
    expect(
      screen.queryByTestId("fact-location-participant-warning"),
    ).toBeNull();

    fireEvent.change(input, { target: { value: "Jane Smith 430123456" } });
    const warning = screen.getByTestId("fact-location-participant-warning");
    expect(warning).toHaveAttribute("role", "status");
    expect(warning).toHaveTextContent(
      "This looks like it contains a person's name. Use a reference code such as P-014 instead of naming a participant.",
    );
    expect(warning).toHaveTextContent(
      "This looks like an NDIS participant number. Do not enter participant numbers.",
    );
    expect(input.value).toBe("Jane Smith 430123456");
    expect(input.getAttribute("aria-describedby")).toContain(
      "fact-location-participant-warning",
    );

    // Warn, never block: the answer still saves, and the set id goes with it.
    fireEvent.click(screen.getByTestId("finish-next"));
    await screen.findByTestId("finish-done");
    expect(saveFactAction).toHaveBeenCalledWith({
      key: "location",
      value: "Jane Smith 430123456",
      setId: SET_ID,
    });
  });
});
