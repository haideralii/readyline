"use client";
/**
 * REQ-024 Session A3 (SR-1; AC-11; D-2414; findings 31, 37, 161, 164): the
 * collection notice a worker sees once, on the first sign-in: who holds
 * what about them, who receives their code and numbers, the one-time file
 * their manager may build, and "the provider you work for", never "your
 * employer". One button; the fieldset is disabled until React is live
 * (D-1012), so a tap before hydration posts nothing.
 */
import { useSyncExternalStore } from "react";
import { WORKER_NOTICE } from "@/lib/registers/worker";
import { workerNoticeSeenAction } from "@/server/registers/worker-notice-actions";

export function WorkerNotice({ tradingName }: { tradingName: string }) {
  const live = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  return (
    <section
      aria-labelledby="worker-notice-heading"
      className="border-rule rounded-md border p-4 sm:p-6"
      data-testid="worker-collection-notice"
    >
      <h1 id="worker-notice-heading" className="">
        {WORKER_NOTICE.heading}
      </h1>
      {WORKER_NOTICE.paragraphs(tradingName).map((p, i) => (
        <p key={i} className="mt-3 leading-7">
          {p}
        </p>
      ))}
      <form action={() => workerNoticeSeenAction({})} className="mt-6">
        <fieldset disabled={!live} className="contents">
          <button
            type="submit"
            className="btn-primary"
            data-testid="worker-notice-continue"
          >
            {WORKER_NOTICE.button}
          </button>
        </fieldset>
      </form>
    </section>
  );
}
