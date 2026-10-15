"use client";
import { useActionState } from "react";
import { acceptInvitationAction } from "@/server/registers/invitation-actions";

/** One button (REQ-017's one-step rule): accept, then the worker home. */
export function AcceptInvitation({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvitationAction, null);
  return (
    <form action={action} className="mt-6">
      <input type="hidden" name="token" value={token} />
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending || undefined}
        className="btn-primary"
        data-testid="invite-accept"
      >
        {pending ? "Joining…" : "Accept and start logging"}
      </button>
      {state && !state.ok ? (
        <p role="alert" className="mt-3 text-sm leading-6">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
