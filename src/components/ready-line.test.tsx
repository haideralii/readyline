import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ReadyLine, readyLineGeometry, readyLineSentence } from "./ready-line";

/** REQ-028 FR-4 (AC-4, D-2803 as amended): two colours on one track, never empty; the track only for nothing to count. */
afterEach(cleanup);

describe("readyLineGeometry", () => {
  it("draws a 0-of-N result as a full ochre line with no moss", () => {
    expect(readyLineGeometry({ done: 0, todo: 7 })).toEqual({
      done: 0,
      todo: 100,
      track: false,
    });
  });
  it("draws N of N as full moss", () => {
    expect(readyLineGeometry({ done: 5, todo: 0 })).toEqual({
      done: 100,
      todo: 0,
      track: false,
    });
  });
  it("shows the track only when both quantities are 0", () => {
    expect(readyLineGeometry({ done: 0, todo: 0 })).toEqual({
      done: 0,
      todo: 0,
      track: true,
    });
  });
  it("splits the line by the share done", () => {
    expect(readyLineGeometry({ done: 1, todo: 3 })).toEqual({
      done: 25,
      todo: 75,
      track: false,
    });
  });
});

describe("ReadyLine", () => {
  it("renders the ochre segment under a moss one and keeps the caller's sentence", () => {
    render(
      <ReadyLine
        counts={{ done: 1, todo: 3 }}
        sentence="Your pack is ready; the registers come with the subscription."
        testId="r"
      />,
    );
    expect(screen.getByTestId("r-todo").getAttribute("class")).toContain(
      "fill-ochre",
    );
    expect(screen.getByTestId("r-done").getAttribute("width")).toBe("25");
    expect(screen.getByTestId("r-text").textContent).toBe(
      "Your pack is ready; the registers come with the subscription.",
    );
    expect(screen.queryByTestId("r-track")).toBeNull();
  });
  it("renders the track alone for an empty index and the default sentence", () => {
    render(
      <ReadyLine counts={{ done: 0, todo: 0 }} noun="registers" testId="r" />,
    );
    expect(screen.getByTestId("r-track").getAttribute("class")).toContain(
      "fill-track",
    );
    expect(screen.queryByTestId("r-done")).toBeNull();
    expect(screen.getByTestId("r-text").textContent).toBe(
      readyLineSentence({ done: 0, todo: 0 }, "registers"),
    );
  });
});
