import { PageShell } from "@/components/page-shell";
import type { Metadata } from "next";
import Link from "next/link";

/** QA pass F9 (WCAG 2.4.2): the page's own title through the root layout's template, not the home page's. */
export const metadata: Metadata = { title: "Page not found" };

/**
 * The 404 page (batch 47 item 8): inside the site shell with the header and
 * footer the root layout renders, one sentence, and the two places a
 * visitor most likely wanted. Next.js answers 404 for it.
 */
export default function NotFound() {
  return (
    <PageShell kind="reading">
      <h1 className="">That page is not here.</h1>
      <p className="text-ink mt-4 leading-7">
        The link may be old or mistyped. Start with the free questions, or read
        the guides.
      </p>
      <ul className="mt-6 flex flex-wrap gap-4" data-testid="not-found-links">
        <li>
          <Link href="/start" className="btn-primary">
            Start the questions
          </Link>
        </li>
        <li>
          <Link
            href="/guides"
            className="inline-flex min-h-11 items-center underline underline-offset-4"
          >
            Read the guides
          </Link>
        </li>
      </ul>
    </PageShell>
  );
}
