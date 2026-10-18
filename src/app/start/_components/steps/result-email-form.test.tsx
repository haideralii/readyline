import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RESULT_EMAIL_BUTTON,
  RESULT_EMAIL_LABEL,
  RESULT_EMAIL_PRIVACY_LINE,
  RESULT_EMAIL_PRIVACY_LINK,
} from "./result-copy";
import { ResultEmailForm } from "./result-email-form";

/**
 * REQ-031 AC-2's first clause (the acceptance self-check, 18 Oct 2026): a
 * signed-in owner's address is in the field before they type; signed out the
 * field is empty. D-2891's line and its /privacy link sit under the field.
 */
vi.mock("../questionnaire-provider", () => ({
  useQuestionnaire: () => ({ answers: {}, mode: "server" }),
}));
vi.mock("@/server/path/result-email-actions", () => ({
  sendResultEmailAction: vi.fn(),
}));

afterEach(() => cleanup());

describe("ResultEmailForm", () => {
  it("prefills a signed-in owner's address and shows the privacy line with its link", () => {
    render(<ResultEmailForm prefill="owner@example.test" />);
    const field = screen.getByLabelText(RESULT_EMAIL_LABEL) as HTMLInputElement;
    expect(field.value).toBe("owner@example.test");
    expect(field.type).toBe("email");
    expect(screen.getByTestId("result-email-privacy").textContent).toContain(
      RESULT_EMAIL_PRIVACY_LINE,
    );
    const link = screen.getByRole("link", { name: RESULT_EMAIL_PRIVACY_LINK });
    expect(link.getAttribute("href")).toBe("/privacy");
    expect(
      screen.getByRole("button", { name: RESULT_EMAIL_BUTTON }),
    ).toBeTruthy();
  });

  it("leaves the field empty when there is no address to prefill", () => {
    render(<ResultEmailForm prefill={null} />);
    const field = screen.getByLabelText(RESULT_EMAIL_LABEL) as HTMLInputElement;
    expect(field.value).toBe("");
  });
});
