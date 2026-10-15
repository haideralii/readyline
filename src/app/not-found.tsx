import Link from "next/link";

/**
 * The 404 page (batch 47 item 8): inside the site shell with the header and
 * footer the root layout renders, one sentence, and the two places a
 * visitor most likely wanted. Next.js answers 404 for it.
 */
export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6 sm:py-24">
      <h1 className="text-3xl font-semibold tracking-tight">
        That page is not here.
      </h1>
      <p className="mt-4 leading-7 text-zinc-700 dark:text-zinc-300">
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
    </div>
  );
}
