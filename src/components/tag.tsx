import type { ReactNode } from "react";

/**
 * REQ-028 FR-13 (second pass 36): the one tag. 13 px, `rounded-full`, five
 * variants each with its icon and its own `bg-surface` fill, so a row's
 * `hover:bg-mist` or `bg-sky` never sits under ochre, moss or signal text.
 * It replaces the three recipes the pages grew: the register list's
 * `StatusTag`, the result's `HaveTag` and the supports step's audit and
 * mandatory pills (D-2274). A tag never splits across lines unless `wrap`
 * says so: the one long pill, class 0138's "registration mandatory from
 * 1 July 2026", wraps at 360 (D-2271 (6)).
 */
export type TagVariant = "neutral" | "need" | "doing" | "done" | "error";

export const TAG_ICONS: Record<TagVariant, string> = {
  neutral: "○",
  need: "!",
  doing: "◐",
  done: "✓",
  error: "!",
};

const TONES: Record<TagVariant, string> = {
  neutral: "border-line text-slate",
  need: "border-ochre text-ochre",
  doing: "border-ochre text-ochre",
  done: "border-moss text-moss",
  error: "border-signal text-signal",
};

const BASE =
  "bg-surface inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[13px] leading-5 font-medium";

export function Tag({
  variant,
  children,
  icon = true,
  wrap = false,
  className,
  testId,
  ...rest
}: {
  variant: TagVariant;
  children: ReactNode;
  /** The variant's icon before the text; off for a tag that is a code or a count. */
  icon?: boolean;
  /** Let the text wrap inside the pill (a long pill at 360). */
  wrap?: boolean;
  className?: string;
  testId?: string;
} & Record<`data-${string}`, string | undefined>) {
  const classes = [
    BASE,
    wrap ? null : "whitespace-nowrap",
    TONES[variant],
    className ?? null,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span
      className={classes}
      data-testid={testId}
      data-variant={variant}
      {...rest}
    >
      {icon ? <span aria-hidden="true">{TAG_ICONS[variant]}</span> : null}
      {children}
    </span>
  );
}
