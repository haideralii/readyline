/**
 * The ready line as a progress indicator (REQ-013 FR-7, REQ-014 motif): one
 * horizontal track that fills in the accent as steps complete, with the
 * plain "Step 2 of 6: Supports" label beneath. Accessible as a progressbar
 * with the same label; the visual is an SVG whose geometry is attributes,
 * not inline styles, so the nonce-only CSP holds (REQ-002). The fill
 * animates once on load; the stylesheet disables it under
 * prefers-reduced-motion.
 */
/**
 * How much of the line is filled on step `current` of `total` (REQ-014 R-2):
 * the share of steps reached, so step 2 of 6 shows a third and the last step
 * shows the whole line. Never below 4% so the start of the line is visible.
 */
export function progressPercent(current: number, total: number): number {
  const n = Math.max(total, 1);
  const c = Math.min(Math.max(current, 1), n);
  return Math.max(Math.round((c / n) * 100), 4);
}

export function ProgressLine({
  current,
  total,
  label,
  id,
}: {
  /** 1-based position of the current step. */
  current: number;
  total: number;
  /** For example "Step 2 of 6: Supports". */
  label: string;
  id?: string;
}) {
  const percent = progressPercent(current, total);
  return (
    <div data-testid="progress-line">
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-valuetext={label}
        aria-label={label}
        className="ready-line"
      >
        <svg
          viewBox="0 0 100 6"
          preserveAspectRatio="none"
          width="100%"
          height="6"
          aria-hidden="true"
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
          <rect
            x="0"
            y="0"
            width={percent}
            height="6"
            rx="3"
            className="ready-line-fill fill-ochre"
            data-testid="progress-line-fill"
          />
        </svg>
      </div>
      <p
        id={id}
        className="text-slate mt-2 text-sm font-medium"
        data-testid="progress-line-label"
      >
        {label}
      </p>
    </div>
  );
}
