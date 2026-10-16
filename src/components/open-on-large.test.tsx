import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LARGE, OpenOnLarge } from "./open-on-large";

/**
 * REQ-028 D-2813 (amended), the unit cases: opens at lg on a first visit,
 * stays closed under lg, a reader's close survives a resize within lg, a
 * crossing into lg opens it once, and "remembered closed stays closed at lg"
 * (third pass 46) when the caller passes its remembered value.
 */
type Listener = (e: { matches: boolean }) => void;
let matches = false;
let listeners: Listener[] = [];

beforeEach(() => {
  listeners = [];
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === LARGE ? matches : false,
    media: query,
    addEventListener: (_: string, fn: Listener) => listeners.push(fn),
    removeEventListener: (_: string, fn: Listener) => {
      listeners = listeners.filter((l) => l !== fn);
    },
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const details = () => screen.getByTestId("d") as HTMLDetailsElement;
const cross = (into: boolean) =>
  act(() => {
    matches = into;
    for (const l of listeners) l({ matches: into });
  });

describe("OpenOnLarge (REQ-028 D-2813)", () => {
  it("opens on mount at lg on a first visit and stays closed under lg", () => {
    matches = true;
    const { unmount } = render(
      <OpenOnLarge data-testid="d">
        <summary>More</summary>
        <p>Body</p>
      </OpenOnLarge>,
    );
    expect(details().open).toBe(true);
    unmount();
    matches = false;
    render(
      <OpenOnLarge data-testid="d">
        <summary>More</summary>
        <p>Body</p>
      </OpenOnLarge>,
    );
    expect(details().open).toBe(false);
  });

  it("a reader's close survives a resize within lg; a crossing into lg opens a closed section once", () => {
    matches = true;
    render(
      <OpenOnLarge data-testid="d">
        <summary>More</summary>
        <p>Body</p>
      </OpenOnLarge>,
    );
    expect(details().open).toBe(true);
    // The person closes it.
    act(() => {
      details().open = false;
      details().dispatchEvent(new Event("toggle"));
    });
    expect(details().open).toBe(false);
    // A change event while still at lg (a resize within lg) opens nothing.
    cross(true);
    expect(details().open).toBe(false);
    // Leaving lg and coming back opens it once.
    cross(false);
    expect(details().open).toBe(false);
    cross(true);
    expect(details().open).toBe(true);
  });

  it("remembered closed stays closed at lg; the remembered value wins and the toggle reports through onToggle (third pass 46)", () => {
    matches = true;
    const onToggle = vi.fn();
    const { rerender } = render(
      <OpenOnLarge data-testid="d" open={false} onToggle={onToggle}>
        <summary>More</summary>
        <p>Body</p>
      </OpenOnLarge>,
    );
    expect(details().open).toBe(false);
    expect(onToggle).not.toHaveBeenCalled();
    cross(false);
    cross(true);
    expect(details().open).toBe(false);
    expect(onToggle).not.toHaveBeenCalled();
    // The person opens it: the caller hears the new value and renders it.
    act(() => {
      details().open = true;
      details().dispatchEvent(new Event("toggle"));
    });
    expect(onToggle).toHaveBeenCalledWith(true);
    rerender(
      <OpenOnLarge data-testid="d" open onToggle={onToggle}>
        <summary>More</summary>
        <p>Body</p>
      </OpenOnLarge>,
    );
    expect(details().open).toBe(true);
  });
});
