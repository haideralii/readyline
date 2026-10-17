import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TAG_ICONS, Tag } from "./tag";

/** REQ-028 FR-13 (second pass 36): one tag, five variants, each on its own surface fill with an icon. */
afterEach(cleanup);

describe("Tag", () => {
  it("renders each variant with its icon, its tone and the surface fill", () => {
    for (const variant of [
      "neutral",
      "need",
      "doing",
      "done",
      "error",
    ] as const) {
      render(
        <Tag variant={variant} testId={`t-${variant}`}>
          Label {variant}
        </Tag>,
      );
      const el = screen.getByTestId(`t-${variant}`);
      expect(el.textContent).toContain(TAG_ICONS[variant]);
      expect(el.textContent).toContain(`Label ${variant}`);
      expect(el.className).toContain("bg-surface");
      expect(el.className).toContain("rounded-full");
      expect(el.getAttribute("data-variant")).toBe(variant);
    }
  });

  it("leaves the icon out for a code or a count, and keeps the row's data attributes", () => {
    render(
      <Tag variant="neutral" icon={false} testId="t" data-status="open">
        0107
      </Tag>,
    );
    const el = screen.getByTestId("t");
    expect(el.textContent).toBe("0107");
    expect(el.getAttribute("data-status")).toBe("open");
    expect(el.querySelector("[aria-hidden]")).toBeNull();
  });

  it("wraps as text when asked, for a long pill at 360 (A1's class 0138 lesson)", () => {
    render(
      <Tag variant="neutral" icon={false} wrap testId="t">
        registration mandatory from 1 July 2026
      </Tag>,
    );
    expect(screen.getByTestId("t").className).not.toContain(
      "whitespace-nowrap",
    );
  });
});
