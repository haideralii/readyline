import type { DetailsHTMLAttributes, MouseEvent, ReactNode } from "react";
import { OpenOnLarge } from "./open-on-large";

/**
 * REQ-028 FR-13 (D-2813, D-2274): the one disclosure. A chevron, a 16 px
 * semibold summary, a `--rule` top border, and a `quiet` variant for the
 * glossary (a plain underlined line). With `openOnLarge` it renders through
 * `OpenOnLarge`, which opens it at `lg` on a first visit and follows the
 * crossing rule; otherwise it is a plain `<details>`. A caller that
 * remembers the state passes `open` and `onToggle`, and `onSummaryClick`
 * hears the click in its own task with the state the click produces (the
 * result page records it there, #40). It replaces the result page's local
 * disclosure and the glossary's own `<details>`.
 */
export function Disclosure({
  summary,
  children,
  variant = "default",
  openOnLarge = false,
  open,
  onToggle,
  onSummaryClick,
  summaryTestId,
  summaryClassName,
  bodyClassName,
  className,
  ...rest
}: {
  summary: ReactNode;
  children: ReactNode;
  variant?: "default" | "quiet";
  openOnLarge?: boolean;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  /** The click on this element's own summary, with the open state it will produce. */
  onSummaryClick?: (nextOpen: boolean) => void;
  summaryTestId?: string;
  summaryClassName?: string;
  bodyClassName?: string;
  className?: string;
} & Omit<
  DetailsHTMLAttributes<HTMLDetailsElement>,
  "open" | "onToggle" | "onClick" | "className"
>) {
  const quiet = variant === "quiet";
  const summaryClass = [
    "disclosure-summary",
    quiet
      ? "min-h-11 cursor-pointer py-2 text-sm font-medium underline-offset-4 hover:underline"
      : "min-h-12 cursor-pointer px-4 py-3 text-base font-semibold",
    summaryClassName ?? null,
  ]
    .filter(Boolean)
    .join(" ");
  const outer = [
    "border-rule mt-4 border-t",
    quiet ? "pt-1" : null,
    className ?? null,
  ]
    .filter(Boolean)
    .join(" ");
  const onClick = onSummaryClick
    ? (e: MouseEvent<HTMLDetailsElement>) => {
        // Only this element's own summary: a nested disclosure's click bubbles here too.
        const s = (e.target as HTMLElement).closest("summary");
        if (!s || s.parentElement !== e.currentTarget) return;
        onSummaryClick(!e.currentTarget.open);
      }
    : undefined;
  const body = (
    <>
      <summary className={summaryClass} data-testid={summaryTestId}>
        <span aria-hidden="true" className="disclosure-chevron">
          ›
        </span>
        {summary}
      </summary>
      <div className={bodyClassName ?? (quiet ? "" : "px-4 pb-4")}>
        {children}
      </div>
    </>
  );
  if (openOnLarge)
    return (
      <OpenOnLarge
        className={outer}
        open={open}
        onToggle={onToggle}
        onClick={onClick}
        {...rest}
      >
        {body}
      </OpenOnLarge>
    );
  return (
    <details
      className={outer}
      open={open}
      onToggle={
        onToggle
          ? (e) => onToggle((e.currentTarget as HTMLDetailsElement).open)
          : undefined
      }
      onClick={onClick}
      {...rest}
    >
      {body}
    </details>
  );
}
