/**
 * The progress line (REQ-013 FR-7; the "ready line" of REQ-014 builds on
 * it): one horizontal bar that fills as steps complete, with the plain
 * "Step 2 of 6: Supports" label beneath. Accessible as a progressbar with
 * the same label; the visual fill is decorative.
 */
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
  const percent = Math.round(((current - 1) / Math.max(total - 1, 1)) * 100);
  return (
    <div data-testid="progress-line">
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-valuetext={label}
        aria-label={label}
        className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
      >
        <div
          className="h-full rounded-full bg-zinc-900 transition-[width] duration-500 motion-reduce:transition-none dark:bg-zinc-100"
          style={{ width: `${Math.max(percent, 4)}%` }}
          data-testid="progress-line-fill"
        />
      </div>
      <p
        id={id}
        className="mt-2 text-sm font-medium text-zinc-700 dark:text-zinc-300"
        data-testid="progress-line-label"
      >
        {label}
      </p>
    </div>
  );
}
