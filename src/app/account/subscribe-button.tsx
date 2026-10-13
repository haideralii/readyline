"use client";
import { useActionState } from "react";
import {
  billingPortalAction,
  subscribeAction,
} from "@/server/payments/actions";

/**
 * The registers subscription buttons (REQ-009 Session C): plain form posts
 * that work without JavaScript; with it, the message for a refused start
 * shows in place. No pre-ticked anything, no trial, no instalments
 * (CLAUDE.md 5).
 */
export function SubscribeButton({
  label,
  cancelPath,
  testId = "subscribe-button",
}: {
  label: string;
  cancelPath: "/pricing" | "/account" | "/registers";
  testId?: string;
}) {
  const [state, action, pending] = useActionState(subscribeAction, null);
  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="cancelPath" value={cancelPath} />
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending || undefined}
        className="btn-primary"
        data-testid={testId}
      >
        {pending ? "Taking you to the payment page…" : label}
      </button>
      {state && !state.ok ? (
        <p role="alert" className="mt-3 text-sm leading-6">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function BillingPortalButton() {
  const [state, action, pending] = useActionState(billingPortalAction, null);
  return (
    <form action={action} className="mt-3">
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending || undefined}
        className="btn-secondary"
        data-testid="billing-portal-button"
      >
        {pending ? "Opening…" : "Manage billing: cancel or change your card"}
      </button>
      {state && !state.ok ? (
        <p role="alert" className="mt-3 text-sm leading-6">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
