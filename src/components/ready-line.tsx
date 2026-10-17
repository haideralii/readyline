/**
 * The ready line with two segments (REQ-014 motif; REQ-013 batch 36 item 3;
 * REQ-028 FR-4, D-2803 as amended): how ready a provider is. Moss for what
 * is done, ochre for what is still to do, on an 8 px track, so the line is
 * never empty: a 0-of-N result is a full ochre line and an N-of-N one a
 * full moss line. `--track` is the colour of the line only when both
 * quantities are 0 (an empty register index) and nowhere else. Shared by
 * the result summary, the home example and the registers line; the
 * questionnaire's step indicator is the single-fill form in
 * progress-line.tsx. An SVG whose geometry is attributes, not inline
 * styles, so the nonce-only CSP holds. The visual is decorative; the
 * sentence beneath carries the numbers for everyone, in the caller's words
 * (REQ-025 FR-3's pack sentence on the result, "N of 15 registers started"
 * on the index; second pass 35).
 */
export type ReadyLineCounts = {
  done: number;
  /** Still to do, whoever does it. */
  todo: number;
};

export function readyLineSentence(c: ReadyLineCounts, noun: string): string {
  const total = c.done + c.todo;
  return c.todo
    ? `${c.done} of ${total} ${noun} in place, ${c.todo} still to do.`
    : `${c.done} of ${total} ${noun} in place.`;
}

/** The segment widths out of 100, and whether the track shows (both quantities 0). */
export function readyLineGeometry(c: ReadyLineCounts): {
  done: number;
  todo: number;
  track: boolean;
} {
  const total = c.done + c.todo;
  if (total <= 0) return { done: 0, todo: 0, track: true };
  const done = (Math.max(c.done, 0) / total) * 100;
  return { done, todo: 100 - done, track: false };
}

export function ReadyLine({
  counts,
  noun,
  sentence,
  testId = "ready-line",
  sentenceTestId,
  live = false,
}: {
  counts: ReadyLineCounts;
  /** "register entries", "documents and registers"; used by the default sentence. */
  noun?: string;
  /** The sentence under the line; the default counts the noun. */
  sentence?: string;
  testId?: string;
  /** REQ-028 FR-9: a page whose status line is this sentence names it (the checklist's progress line). */
  sentenceTestId?: string;
  /** With `live`, the sentence is a polite live region, so a save that changes the count is announced. */
  live?: boolean;
}) {
  const g = readyLineGeometry(counts);
  return (
    <div data-testid={testId}>
      <div className="ready-line" aria-hidden="true">
        <svg
          viewBox="0 0 100 8"
          preserveAspectRatio="none"
          width="100%"
          height="8"
          focusable="false"
          className="block"
        >
          {/* The still-to-do segment is the whole line underneath; the track only when there is nothing to count. */}
          <rect
            x="0"
            y="0"
            width="100"
            height="8"
            rx="4"
            className={g.track ? "fill-track" : "fill-ochre"}
            data-testid={`${testId}-${g.track ? "track" : "todo"}`}
          />
          {g.done > 0 ? (
            <rect
              x="0"
              y="0"
              width={g.done}
              height="8"
              rx="4"
              className="ready-line-fill fill-moss"
              data-testid={`${testId}-done`}
            />
          ) : null}
        </svg>
      </div>
      <p
        className="text-slate mt-2 text-sm"
        data-testid={sentenceTestId ?? `${testId}-text`}
        role={live ? "status" : undefined}
        aria-live={live ? "polite" : undefined}
      >
        {sentence ?? readyLineSentence(counts, noun ?? "things")}
      </p>
    </div>
  );
}
