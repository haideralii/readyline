import { DOCUMENTS_COPY as C } from "@/lib/payments/documents-copy";

/**
 * Shown while the documents page reads the purchase state (REQ-015 FR-14).
 * Under this route only, for the reason given in checklist/loading.tsx.
 *
 * Backlog 2 (D-1012): the heading and the intro are the same as the page's,
 * so the largest text paints with the first paint and stays where it is
 * when the page arrives; the block below keeps a page's height so the
 * footer does not jump into view and back out (Lighthouse measured that as
 * a 0.4 layout shift on a phone).
 */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-semibold tracking-tight">Your documents</h1>
      <p className="mt-3 leading-7 text-zinc-700 dark:text-zinc-300">
        {C.intro}
      </p>
      <div className="min-h-[70vh]" role="status" aria-live="polite">
        <p className="mt-6 text-zinc-600 dark:text-zinc-400">
          Loading your documents…
        </p>
      </div>
    </div>
  );
}
