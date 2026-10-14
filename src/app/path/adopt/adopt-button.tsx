"use client";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { adoptGroupAction } from "@/server/path/actions";

/**
 * "These are our policies" (REQ-017 step 5): one button, pending text while
 * the documents are re-rendered, the message in place when it fails, and
 * the next screen on success. Disabled until hydration (batch 45b item 2,
 * D-1704): a click in the server-HTML window would otherwise do nothing,
 * and a click that waits for the button to enable always reaches the
 * action.
 */
export function AdoptButton({
  setId,
  group,
  nextHref,
  today,
}: {
  setId: string;
  group: string;
  nextHref: string;
  /** Today in Sydney, the default circulation date (REQ-018 FR-14). */
  today: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [workers, setWorkers] = useState("");
  const [on, setOn] = useState(today);
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  async function onClick() {
    setPending(true);
    setMessage(null);
    const codes = workers.trim();
    const r = await adoptGroupAction({
      setId,
      group,
      ...(codes
        ? { circulation: { worker_refs: codes, circulated_on: on } }
        : {}),
    });
    if (r.ok) {
      router.push(nextHref);
      router.refresh();
      return;
    }
    setPending(false);
    setMessage(r.message);
  }
  return (
    <div className="mt-6">
      {/* REQ-018 FR-14: who was walked through these documents, and when; the document control register shows it. */}
      <div
        className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
        data-testid="circulation"
      >
        <label htmlFor="circulation-workers" className="block font-medium">
          Who did you walk these through? (optional)
        </label>
        <p
          id="circulation-workers-help"
          className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400"
        >
          Worker codes, separated by spaces: W-1 W-2. Auditors ask how workers
          were told about a policy; this is the record.
        </p>
        <input
          id="circulation-workers"
          name="circulation-workers"
          type="text"
          value={workers}
          onChange={(e) => setWorkers(e.target.value)}
          aria-describedby="circulation-workers-help"
          maxLength={200}
          className="mt-2 block w-full rounded-md border border-zinc-400 px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-zinc-600 dark:bg-zinc-900"
        />
        <label
          htmlFor="circulation-on"
          className="mt-3 block text-sm font-medium"
        >
          On what date
        </label>
        <input
          id="circulation-on"
          name="circulation-on"
          type="date"
          value={on}
          onChange={(e) => setOn(e.target.value)}
          className="mt-1 block min-h-11 rounded-md border border-zinc-400 px-3 py-2 text-base dark:border-zinc-600 dark:bg-zinc-900"
        />
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={pending || !hydrated}
        className="btn-primary mt-4"
        data-testid="adopt-group"
      >
        {pending ? "Making them yours…" : "These are our policies"}
      </button>
      {message ? (
        <p role="alert" className="mt-3 text-sm leading-6">
          {message}
        </p>
      ) : null}
    </div>
  );
}
