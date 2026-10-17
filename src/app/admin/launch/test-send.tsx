"use client";
import { useActionState } from "react";
import {
  sendTestEmailAction,
  type TestSendResponse,
} from "@/server/admin/launch-actions";

/**
 * REQ-022 FR-6: the one button under the email rows. A plain form post so
 * it works without JavaScript; with it, the outcome shows in place. The
 * message never carries the address.
 */
export function TestSend() {
  const [state, action, pending] = useActionState<
    TestSendResponse | null,
    FormData
  >(async (_previous, formData) => sendTestEmailAction(formData), null);
  return (
    <form action={action} className="mt-4" data-testid="test-send">
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending || undefined}
        className="btn-secondary"
        data-testid="test-send-button"
      >
        {pending ? "Sending…" : "Send me a test email"}
      </button>
      <p className="text-slate mt-2 text-sm leading-6">
        To your own address, through the configured provider; one a minute. With
        the log provider the send is recorded, not delivered.
      </p>
      {state ? (
        <p
          role="status"
          className="text-ink mt-2 text-sm leading-6"
          data-testid="test-send-result"
        >
          {state.ok
            ? `Sent through the ${state.provider} provider. Reload to see the row turn green, then check your inbox.`
            : state.message}
        </p>
      ) : null}
    </form>
  );
}
