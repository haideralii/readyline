"use client";
import { useActionState } from "react";
import { buyAction } from "@/server/payments/actions";

/**
 * The Buy form (REQ-007 FR-2, FR-6). A plain form post so it works without
 * JavaScript; with it, the message for a refused checkout shows in place.
 * No checkbox, no pre-ticked anything (CLAUDE.md 5).
 */
export function BuyButton({
  label,
  cancelPath,
  testId = "buy-button",
}: {
  label: string;
  cancelPath:
    "/pricing" | "/documents" | "/start/result" | "/path/before-you-buy";
  testId?: string;
}) {
  const [state, action, pending] = useActionState(buyAction, null);
  return (
    <form action={action} className="mt-4">
      <input type="hidden" name="cancelPath" value={cancelPath} />
      {/* The identity's primary button (REQ-014), like every other primary action on the path (backlog 1, D-1508). */}
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending || undefined}
        data-testid={testId}
        className="btn-primary disabled:opacity-60"
      >
        {pending ? "Taking you to the payment page…" : label}
      </button>
      {state && !state.ok ? (
        <p role="alert" className="text-ink mt-3 text-sm leading-6">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
