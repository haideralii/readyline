// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LOADING_NOTE_AFTER_MS,
  LOADING_NOTE_TEXT,
  LoadingNote,
} from "./fields";

/** Live QA of b340ee3, D8: the loading state says something after five seconds and nothing before. */
describe("LoadingNote", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows nothing before the delay and the one line after it, as a status", () => {
    render(<LoadingNote />);
    expect(screen.queryByRole("status")).toBeNull();
    act(() => vi.advanceTimersByTime(LOADING_NOTE_AFTER_MS - 1));
    expect(screen.queryByRole("status")).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("status")).toHaveTextContent(LOADING_NOTE_TEXT);
  });

  it("says nothing when the loading state ends first", () => {
    const { unmount } = render(<LoadingNote afterMs={50} />);
    unmount();
    act(() => vi.advanceTimersByTime(100));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
