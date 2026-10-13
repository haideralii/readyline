/**
 * Shown while the documents page reads the purchase state (REQ-015 FR-14).
 * Under this route only, for the reason given in checklist/loading.tsx.
 */
export default function Loading() {
  return (
    <div
      className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14"
      role="status"
      aria-live="polite"
    >
      <p className="text-zinc-600 dark:text-zinc-400">
        Loading your documents…
      </p>
    </div>
  );
}
