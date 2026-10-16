import { PageShell } from "@/components/page-shell";
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
    <PageShell kind="grid">
      <h1 className="text-3xl font-semibold tracking-tight">Your documents</h1>
      <p className="text-ink mt-3 leading-7">{C.intro}</p>
      <div className="min-h-[70vh]" role="status" aria-live="polite">
        <p className="text-slate mt-6">Loading your documents…</p>
      </div>
    </PageShell>
  );
}
