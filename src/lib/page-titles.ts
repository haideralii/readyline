import type { Metadata } from "next";

/** The 404 page's title through the root layout's template (QA pass F9, WCAG 2.4.2). */
export const NOT_FOUND_TITLE = "Page not found";

/**
 * QA live b340ee3, B #57: a private route that ends in `notFound()` must
 * answer this from `generateMetadata` too, or the tab title flips to the
 * route's own title after hydration while the body is the 404 page.
 */
export const notFoundMetadata: Metadata = {
  title: NOT_FOUND_TITLE,
  robots: { index: false, follow: false },
};
