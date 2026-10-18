"use client";
import { useActionState } from "react";
import {
  resumeRemindersAction,
  type ResumeRemindersResult,
} from "@/server/email/reminder-actions";

/**
 * Live QA of b340ee3, D-2836: the account page's "Reminder emails" line.
 * Off: "Reminder emails: off since <date>." with one button that turns them
 * back on; on: "Reminder emails: on." and nothing to press. The unsubscribe
 * page promised this control.
 */
export function ReminderEmails({
  doNotSend,
  since,
}: {
  doNotSend: boolean;
  /** The day the person stopped them, in words, when they did. */
  since: string | null;
}) {
  const [state, action, pending] = useActionState<
    ResumeRemindersResult | null,
    FormData
  >(resumeRemindersAction, null);
  if (!doNotSend)
    return (
      <p className="mt-2 leading-7" data-testid="reminder-emails-line">
        Reminder emails: on.
      </p>
    );
  return (
    <form action={action} className="mt-2" data-testid="reminder-emails-form">
      <p className="leading-7" data-testid="reminder-emails-line">
        Reminder emails: off{since ? ` since ${since}` : ""}.
      </p>
      <button
        type="submit"
        className="btn-secondary mt-2"
        disabled={pending}
        aria-busy={pending || undefined}
        data-testid="reminder-emails-resume"
      >
        {pending ? "Turning them on…" : "Turn them back on"}
      </button>
      {state && !state.ok ? (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
