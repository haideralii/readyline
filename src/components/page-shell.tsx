import type { ReactNode } from "react";

/**
 * REQ-028 FR-1: one container for every page, used by the site header, the
 * next-step strip, `main` and the footer, so the wordmark, the h1 and the
 * footer links share a left edge. Under `lg` nothing changes: one column, the
 * page's own order. From `lg` the shell is a 12-column grid and the page
 * names its kind in this one place: reading (8 columns of prose at 65ch and
 * a sticky 4-column aside), form (7 columns and the aside), list (the full
 * 12) and grid (the bare 12 for the pages that set their own spans). Session
 * A1 moves every page onto the shell with its one-column content kept; the
 * asides, the header rows and the spans are Sessions B and C's.
 */
export type PageKind = "reading" | "form" | "list" | "grid";

/** The container the header, the strip, `main` and the footer share (1152 px of content at 1216 px and above). */
export const SHELL = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

const MAIN: Record<PageKind, string> = {
  reading: "lg:col-span-8 lg:max-w-prose",
  form: "lg:col-span-7",
  list: "lg:col-span-12",
  grid: "lg:col-span-12",
};

export function PageShell({
  kind,
  aside,
  padding = "default",
  children,
}: {
  kind: PageKind;
  /** The sticky aside of the reading and form kinds (Sessions B and C fill it); ignored by the list and grid kinds. */
  aside?: ReactNode;
  /** The questionnaire keeps its tighter phone top (REQ-015 FR-4: the result card's button inside a 681 px iPhone screen). */
  padding?: "default" | "compact";
  children: ReactNode;
}) {
  const hasAside = Boolean(aside) && (kind === "reading" || kind === "form");
  const py = padding === "compact" ? "py-6 sm:py-12" : "py-8 lg:py-12";
  return (
    <div className={`${SHELL} ${py}`} data-shell="page" data-kind={kind}>
      <div className="lg:grid lg:grid-cols-12 lg:gap-x-8">
        <div className={`min-w-0 ${MAIN[kind]}`}>{children}</div>
        {hasAside ? (
          <aside className="mt-8 lg:sticky lg:top-24 lg:col-span-4 lg:col-start-9 lg:mt-0 lg:self-start">
            {aside}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
