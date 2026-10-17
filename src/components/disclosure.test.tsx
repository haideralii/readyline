import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Disclosure } from "./disclosure";
import { LARGE } from "./open-on-large";

/**
 * REQ-028 FR-13 (D-2813): one disclosure. The default variant carries the
 * chevron and the rule; the quiet variant is the glossary's line; with
 * `openOnLarge` it renders through OpenOnLarge and opens at lg on a first
 * visit; a caller's `open` and `onToggle` are honoured.
 */
let matches = false;
beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === LARGE ? matches : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const details = () => screen.getByTestId("d") as HTMLDetailsElement;

describe("Disclosure", () => {
  it("renders a details with the chevron, the summary and the body, closed by default", () => {
    render(
      <Disclosure summary="Why this result" data-testid="d" summaryTestId="s">
        <p>Body</p>
      </Disclosure>,
    );
    expect(details().open).toBe(false);
    expect(screen.getByTestId("s").textContent).toContain("Why this result");
    expect(screen.getByTestId("s").className).toContain("disclosure-summary");
    expect(screen.getByTestId("s").textContent).toBe("Why this result");
    expect(details().className).toContain("border-rule");
  });

  it("the quiet variant is the glossary's underlined line without the box padding", () => {
    render(
      <Disclosure
        variant="quiet"
        summary="What these words mean (3)"
        data-testid="d"
        summaryTestId="s"
      >
        <dl />
      </Disclosure>,
    );
    expect(screen.getByTestId("s").className).toContain("underline-offset-4");
    expect(screen.getByTestId("s").className).not.toContain("px-4");
  });

  it("opens at lg on a first visit when asked to, and stays closed otherwise", () => {
    matches = true;
    const { unmount } = render(
      <Disclosure summary="More" openOnLarge data-testid="d">
        <p>Body</p>
      </Disclosure>,
    );
    expect(details().open).toBe(true);
    unmount();
    render(
      <Disclosure summary="More" data-testid="d">
        <p>Body</p>
      </Disclosure>,
    );
    expect(details().open).toBe(false);
  });

  it("honours a controlled open and reports the toggle", () => {
    matches = true;
    const onToggle = vi.fn();
    render(
      <Disclosure
        summary="More"
        openOnLarge
        open={false}
        onToggle={onToggle}
        data-testid="d"
      >
        <p>Body</p>
      </Disclosure>,
    );
    expect(details().open).toBe(false);
    act(() => {
      details().open = true;
      details().dispatchEvent(new Event("toggle"));
    });
    expect(onToggle).toHaveBeenCalledWith(true);
  });
});
