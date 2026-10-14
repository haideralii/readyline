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
      {/* The house primary button (REQ-014), the same as the next-step strip's:
          on "before you buy" this is the screen's one button (REQ-017, D-1703). */}
      <button
        type="submit"
        disabled={pending}
        data-testid={testId}
        className="btn-primary"
      >
        {pending ? "Taking you to the payment page…" : label}
      </button>
      {state && !state.ok ? (
        <p
          role="alert"
          className="mt-3 text-sm leading-6 text-zinc-800 dark:text-zinc-200"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
