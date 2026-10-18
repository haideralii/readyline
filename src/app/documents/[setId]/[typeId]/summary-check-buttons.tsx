"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  SUMMARY_CHECK_INTRO,
  SUMMARY_CONFIRM_LABEL,
  SUMMARY_REDRAFT_LABEL,
} from "@/lib/registers/summary-check";
import {
  confirmSummaryAction,
  redraftSummaryAction,
} from "@/server/generation/summary-actions";

/**
 * REQ-033 Session C FR-C2 (D-2978): under the plain-words summary while it is
 * to check, the two ways out, each the owner's act. "Redraft the summary"
 * makes one model request and a new unadopted version; "The summary is still
 * right" records the day and the role on the current version. A refusal is
 * one plain sentence and nothing changes.
 */
export function SummaryCheckButtons({
  setId,
  typeId,
  line,
}: {
  setId: string;
  typeId: string;
  /** FR-C1's line for this document. */
  line: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"redraft" | "confirm" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(
    kind: "redraft" | "confirm",
    fn: () => Promise<{ ok: boolean; message?: string; href?: string }>,
  ) {
    setBusy(kind);
    setMessage(null);
    try {
      const r = await fn();
      if (!r.ok) {
        setMessage(r.message ?? "Something went wrong.");
        return;
      }
      router.push(r.href ?? `/documents/${setId}/${typeId}`);
      router.refresh();
    } catch {
      setMessage(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="border-ochre mt-3 rounded-md border p-4 text-sm leading-6"
      data-testid="summary-check"
    >
      <p className="text-ochre font-medium" data-testid="summary-check-line">
        {line}
      </p>
      <p className="mt-1">{SUMMARY_CHECK_INTRO}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          className="btn-primary"
          disabled={busy !== null}
          aria-busy={busy === "redraft" || undefined}
          onClick={() =>
            void run("redraft", () => redraftSummaryAction({ setId, typeId }))
          }
          data-testid="summary-redraft"
        >
          {busy === "redraft" ? "Drafting…" : SUMMARY_REDRAFT_LABEL}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy !== null}
          aria-busy={busy === "confirm" || undefined}
          onClick={() =>
            void run("confirm", () => confirmSummaryAction({ setId, typeId }))
          }
          data-testid="summary-confirm"
        >
          {busy === "confirm" ? "Recording…" : SUMMARY_CONFIRM_LABEL}
        </button>
      </div>
      {message ? (
        <p
          className="text-signal mt-3"
          role="alert"
          data-testid="summary-check-message"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
