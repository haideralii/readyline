/**
 * The ready line with segments (REQ-014 motif): how ready a provider is.
 * Moss for what is done, ochre for what is still to prepare, mist (the
 * track) for the remainder. Shared by the result summary now and the
 * registers dashboard later (REQ-009); the questionnaire's step indicator is
 * the single-fill form in progress-line.tsx. An SVG whose geometry is
 * attributes, not inline styles, so the nonce-only CSP holds. The visual is
 * decorative; the sentence beneath carries the numbers for everyone.
 */
export type ReadyLineCounts = {
  done: number;
  toPrepare: number;
  remainder: number;
};

export function readyLineSentence(c: ReadyLineCounts, noun: string): string {
  const total = c.done + c.toPrepare + c.remainder;
  const parts = [`${c.done} of ${total} ${noun} in place`];
  if (c.toPrepare) parts.push(`${c.toPrepare} to prepare`);
  if (c.remainder) parts.push(`${c.remainder} not asked about yet`);
  return `${parts.join(", ")}.`;
}

export function ReadyLine({
  counts,
  noun,
  testId = "ready-line",
}: {
  counts: ReadyLineCounts;
  /** "documents and registers", "items", "registers". */
  noun: string;
  testId?: string;
}) {
  const total = Math.max(counts.done + counts.toPrepare + counts.remainder, 1);
  const done = (counts.done / total) * 100;
  const toPrepare = (counts.toPrepare / total) * 100;
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
          {toPrepare > 0 ? (
            <rect
              x={done}
              y="0"
              width={toPrepare}
              height="6"
              className="ready-line-fill fill-ochre"
              data-testid={`${testId}-to-prepare`}
            />
          ) : null}
        </svg>
      </div>
      <p className="text-slate mt-2 text-sm" data-testid={`${testId}-text`}>
        {readyLineSentence(counts, noun)}
      </p>
    </div>
  );
}
