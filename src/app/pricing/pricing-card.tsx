import type { ReactNode } from "react";

/**
 * REQ-028 FR-10 (D-2816): the one skeleton both pricing cards share, so the
 * page where a price is decided pushes neither product: the eyebrow, the
 * product's name, the price at 30 px with tabular figures (or the one
 * sentence for the off state or an unset price), the bullets, the body
 * lines, and one secondary button or the sign-in line at the foot. The two
 * cards share a row from `sm`, so their heights match; the foot sits at the
 * bottom of each.
 */
export function PricingCard({
  id,
  testId,
  eyebrow,
  heading,
  headingId,
  price,
  priceTestId,
  priceNote,
  priceLine,
  bodyTestId,
  bullets,
  bulletsTestId,
  children,
  action,
}: {
  id: string;
  testId: string;
  eyebrow: string;
  heading: string;
  headingId: string;
  /** The figure, or null when the card shows priceLine instead. */
  price: string | null;
  priceTestId: string;
  /** The words beside the figure. */
  priceNote?: string;
  /** The sentence shown when there is no figure. */
  priceLine?: ReactNode;
  /** A test id on the body (the price, the bullets and the children), for the offer's own assertions. */
  bodyTestId?: string;
  bullets?: readonly string[];
  bulletsTestId?: string;
  children?: ReactNode;
  /** The card's one button or the sign-in line, at the foot. */
  action: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      // Live QA of b340ee3, D3: a grid item's minimum width is its content's unless told otherwise, so at 200 % text
      // on a 360 px screen the two cards ran 353 px wide and the page scrolled sideways; the card takes the column.
      className="border-rule flex h-full min-w-0 scroll-mt-6 flex-col rounded-md border p-5 [overflow-wrap:anywhere]"
      data-testid={testId}
    >
      <p className="text-slate text-sm font-medium">{eyebrow}</p>
      <h2 id={headingId} className="mt-1">
        {heading}
      </h2>
      <div data-testid={bodyTestId}>
        {price ? (
          <p className="mt-2">
            <span
              className="text-3xl font-semibold tabular-nums"
              data-testid={priceTestId}
            >
              {price}
            </span>
            {priceNote ? (
              <span className="text-slate"> {priceNote}</span>
            ) : null}
          </p>
        ) : (
          priceLine
        )}
        {bullets?.length ? (
          <ul
            className="text-ink mt-2 list-disc pl-5 leading-7"
            data-testid={bulletsTestId}
          >
            {bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        ) : null}
        {children}
      </div>
      <div className="mt-auto">{action}</div>
    </section>
  );
}
