/**
 * The ready line with two segments (REQ-014 motif; REQ-013 batch 36 item 3):
 * how ready a provider is. Moss for what is done, mist (the track) for what
 * is still to do. Shared by the result summary, the home example and the
 * registers line; the questionnaire's step indicator is the single-fill
 * form in progress-line.tsx. An SVG whose geometry is attributes, not inline
 * styles, so the nonce-only CSP holds. The visual is decorative; the
 * sentence beneath carries the numbers for everyone, in the caller's words.
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

export function ReadyLine({
  counts,
  noun,
  sentence,
  testId = "ready-line",
}: {
  counts: ReadyLineCounts;
  /** "register entries", "documents and registers"; used by the default sentence. */
  noun?: string;
  /** The sentence under the line; the default counts the noun. */
  sentence?: string;
  testId?: string;
}) {
  const total = Math.max(counts.done + counts.todo, 1);
  const done = (counts.done / total) * 100;
  return (
    <div data-testid={testId}>
      <div className="ready-line" aria-hidden="true">
        <svg
          viewBox="0 0 100 6"
          preserveAspectRatio="none"
          width="100%"
          height="6"
          focusable="false"
          className="block"
        >
          <rect
            x="0"
            y="0"
            width="100"
            height="6"
            rx="3"
            className="fill-mist"
            data-testid={`${testId}-todo`}
          />
          {done > 0 ? (
            <rect
              x="0"
              y="0"
              width={done}
              height="6"
              className="ready-line-fill fill-moss"
              data-testid={`${testId}-done`}
            />
          ) : null}
        </svg>
      </div>
      <p className="text-slate mt-2 text-sm" data-testid={`${testId}-text`}>
        {sentence ?? readyLineSentence(counts, noun ?? "things")}
      </p>
    </div>
  );
}
