import { PageShell } from "@/components/page-shell";

/**
 * Shown while the checklist is derived on the server (REQ-015 FR-14). Kept
 * under this route only: a loading boundary above a page that throws
 * notFound() would stream a 200 instead of a 404 (the admin routes).
 */
export default function Loading() {
  // Backlog 2 (D-1012): a page's height, so the footer does not jump when the checklist arrives.
  return (
    <PageShell kind="grid">
      <div className="min-h-[70vh]" role="status" aria-live="polite">
        <p className="text-slate">Loading your checklist…</p>
      </div>
    </PageShell>
  );
}
