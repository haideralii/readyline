"use client";
import { useEffect } from "react";
import { PageShell } from "@/components/page-shell";

/**
 * The page-level error boundary (REQ-030 FR-1). Shows one plain line and the
 * request's reference (Next's digest), which is the `errorId` tag on the
 * server's report and the id in the server's log line, so support can find
 * the matching record without the reader describing what they typed. No
 * browser SDK here (D-2865); the server already reported the error.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Nothing is sent from the browser; the digest is already with the server's report.
  }, [error]);
  return (
    <PageShell kind="reading">
      <h1 className="">Something went wrong</h1>
      <p className="text-ink mt-3 leading-7" data-testid="error-line">
        The page could not be shown. Your work is saved as far as the last step
        you completed. Try again; if it happens twice, email us with the
        reference below.
      </p>
      {error.digest ? (
        <p className="text-slate mt-2 text-sm" data-testid="error-reference">
          Reference: {error.digest}
        </p>
      ) : null}
      <p className="mt-6">
        <button type="button" className="btn-primary" onClick={() => reset()}>
          Try again
        </button>
      </p>
    </PageShell>
  );
}
