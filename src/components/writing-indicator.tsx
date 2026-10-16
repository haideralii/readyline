"use client";
/**
 * The writing indicator (REQ-021, D-2101): what the provider sees while
 * their pack is being written. A pure function of the status the server
 * reports; progress is read from the status endpoint on a short poll and
 * never from a client timer, the animation runs only while progress is
 * arriving, and the Ready state hands the provider to the next step of the
 * guided path. One SVG, currentColor strokes, transforms and opacity only.
 */
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import {
  OFFLINE_AFTER_FAILURES,
  READY_WARM_LINE,
  RECONNECTING_LINE,
  USUAL_TIME_LINE,
  awaySentence,
  counterLine,
  isMoving,
  liveText,
  phaseLine,
  quietState,
  type WritingStatus,
} from "@/lib/generation/writing-state";
import {
  continueWithoutDocumentAction,
  retryDocumentAction,
} from "@/server/generation/attention-actions";

export type WritingIndicatorProps = {
  initial: WritingStatus;
  /** Where to poll; the documents page uses the status route, the test page a scripted feed. */
  pollUrl?: string;
  pollMs?: number;
  /** S11: one section being re-run; the counter and the list are hidden and the document name is fixed. */
  single?: boolean;
  /** Where "Download" goes once ready; `{setId}` is replaced with the ready set's id. */
  downloadHrefTemplate?: string;
};

type Feed = {
  status: WritingStatus;
  failures: number;
  /** The server clock offset learned from the last good poll, so pause detection uses server time. */
  skewMs: number;
};

export function WritingIndicator({
  initial,
  pollUrl = "/api/generation/status",
  pollMs = 5000,
  single = false,
  downloadHrefTemplate = "/documents/{setId}/download?file=set.zip",
}: WritingIndicatorProps) {
  const downloadHref = (setId: string) =>
    downloadHrefTemplate.replace("{setId}", encodeURIComponent(setId));
  const [feed, setFeed] = useState<Feed>(() => ({
    status: initial,
    failures: 0,
    skewMs: Date.parse(initial.serverTime) - Date.now(),
  }));
  const [now, setNow] = useState(() => Date.now());
  const [away, setAway] = useState<string | null>(null);
  const hiddenDone = useRef<number | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [pending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  // True once the client is live, so a test (and a reader of the DOM) can tell the server HTML from the polling component.
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const status = feed.status;
  const finished =
    status.phase === "ready" ||
    status.phase === "attention" ||
    status.phase === "delayed";

  // One immediate refresh when the page comes back (S2); polling while the page is shown.
  useEffect(() => {
    if (finished && status.phase === "ready") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(pollUrl, { cache: "no-store" });
        if (res.status === 204) return;
        if (!res.ok) throw new Error(String(res.status));
        const next = (await res.json()) as WritingStatus;
        if (cancelled) return;
        setFeed({
          status: next,
          failures: 0,
          skewMs: Date.parse(next.serverTime) - Date.now(),
        });
        if (hiddenDone.current !== null) {
          setAway(awaySentence(hiddenDone.current, next));
          hiddenDone.current = null;
        }
      } catch {
        if (cancelled) return;
        setFeed((f) => ({ ...f, failures: f.failures + 1 }));
      }
    };
    const onVisibility = () => {
      if (document.hidden) hiddenDone.current = feed.status.done;
      else void poll();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const id = setInterval(() => {
      if (!document.hidden) void poll();
    }, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pollUrl, pollMs, finished, status.phase, feed.status.done]);

  // The clock for pause detection ticks once a second; nothing else is timed.
  useEffect(() => {
    if (finished) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [finished]);

  // S10: focus the heading once the set is ready.
  useEffect(() => {
    if (status.phase === "ready") headingRef.current?.focus();
  }, [status.phase]);

  const serverNow = now + feed.skewMs;
  const quiet = quietState(status, serverNow);
  const moving = isMoving(status, serverNow);
  const offline = feed.failures >= OFFLINE_AFTER_FAILURES;
  const reconnecting = feed.failures > 0;
  const line = phaseLine(status, quiet);
  // The live region's text changes only when a document completes or the phase changes, never per section (S10): liveText leaves the section out.
  const live = liveText(status, quiet);

  const act = (fn: typeof retryDocumentAction, typeId: string, label: string) =>
    startTransition(async () => {
      setActionMessage(null);
      const r = await fn({ typeId });
      if (!r.ok) setActionMessage(r.message);
      else setActionMessage(label);
    });

  return (
    <div
      className="wi"
      data-testid="writing-indicator"
      data-phase={status.phase}
      data-moving={moving ? "true" : "false"}
      data-quiet={quiet}
      data-offline={offline ? "true" : "false"}
      data-hydrated={hydrated ? "true" : "false"}
    >
      <div className="flex items-start gap-4">
        <PageIcon phase={status.phase} moving={moving} />
        <div className="min-w-0 flex-1">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-xl font-semibold outline-none"
            data-testid="wi-heading"
          >
            {status.phase === "ready"
              ? line
              : status.phase === "attention"
                ? "A few documents need another go"
                : single
                  ? "Writing this section again"
                  : "Writing your documents"}
          </h2>
          {!single && status.phase !== "ready" ? (
            <p className="mt-1 text-2xl font-semibold" data-testid="wi-counter">
              {counterLine(status)}
            </p>
          ) : null}
          {status.phase !== "ready" ? (
            <p className="mt-1 leading-7" data-testid="wi-line">
              {line}
            </p>
          ) : null}
          {/* S10: one polite live region, updated per document or phase, never per section. */}
          <p className="sr-only" aria-live="polite" data-testid="wi-live">
            {live}
          </p>
          {away ? (
            <p className="mt-1 leading-7" data-testid="wi-away">
              {away}
            </p>
          ) : null}
          {status.usualMinutes && status.phase !== "ready" && !single ? (
            <p className="text-slate mt-1 text-sm" data-testid="wi-usual">
              {USUAL_TIME_LINE(status.usualMinutes, status.total)}
            </p>
          ) : null}
          {reconnecting && !finished ? (
            <p
              className="text-slate mt-1 flex items-center gap-2 text-sm"
              data-testid="wi-reconnecting"
            >
              <span aria-hidden="true" className="wi-dot" />
              {offline ? RECONNECTING_LINE : "Reconnecting"}
            </p>
          ) : null}
        </div>
      </div>

      {status.phase === "ready" ? (
        <div className="mt-4" data-testid="wi-ready">
          {status.nextStep ? (
            <Link
              href={status.nextStep.href}
              className="btn-primary"
              data-testid="wi-next-step"
            >
              {status.nextStep.label}
            </Link>
          ) : null}
          {status.readySetId ? (
            <a
              href={downloadHref(status.readySetId)}
              className="btn-secondary mt-3 ml-0 sm:mt-0 sm:ml-3"
              data-testid="wi-download"
            >
              Download all (zip)
            </a>
          ) : null}
          <p className="text-ink mt-3 leading-7">{READY_WARM_LINE}</p>
        </div>
      ) : null}

      {status.phase === "attention" && status.failed.length > 0 ? (
        <ul className="mt-4 space-y-3" data-testid="wi-failed">
          {status.failed.map((f) => (
            <li key={f.typeId} className="border-rule rounded-md border p-3">
              <p className="font-medium">{f.title}</p>
              <p className="text-ink mt-1 text-sm leading-6">
                {f.kind === "degraded"
                  ? "We wrote this one, but too much of it is generic. Try again, or keep it as it is and fill the gaps yourself."
                  : "We could not write this one. Try again, or continue without it and we will show it as missing on your documents page."}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary min-h-11"
                  disabled={pending}
                  onClick={() =>
                    act(retryDocumentAction, f.typeId, "Trying again now.")
                  }
                  data-testid={`wi-retry-${f.typeId}`}
                >
                  Try again
                </button>
                <button
                  type="button"
                  className="btn-secondary min-h-11"
                  disabled={pending}
                  onClick={() =>
                    act(
                      continueWithoutDocumentAction,
                      f.typeId,
                      f.kind === "degraded"
                        ? "Kept as it is."
                        : "Continuing without it.",
                    )
                  }
                  data-testid={`wi-continue-${f.typeId}`}
                >
                  {f.kind === "degraded"
                    ? "Keep it as it is"
                    : "Continue without it"}
                </button>
              </div>
            </li>
          ))}
          {actionMessage ? (
            <li className="text-sm leading-6" role="status">
              {actionMessage}
            </li>
          ) : null}
        </ul>
      ) : null}

      {!single && status.documents.length > 0 && status.phase !== "ready" ? (
        <ol className="mt-4 space-y-1 text-sm leading-6" data-testid="wi-list">
          {status.documents.map((d) => (
            <li
              key={d.typeId}
              className="flex items-start gap-2"
              data-state={d.state}
            >
              <span aria-hidden="true" className="w-4 shrink-0 text-center">
                {d.state === "written"
                  ? "✓"
                  : d.state === "current"
                    ? "✎"
                    : d.state === "failed"
                      ? "!"
                      : "·"}
              </span>
              <span
                className={
                  d.state === "waiting"
                    ? "text-slate"
                    : d.state === "failed"
                      ? "text-signal"
                      : ""
                }
              >
                {d.title}
                <span className="sr-only">
                  {d.state === "written"
                    ? ", written"
                    : d.state === "current"
                      ? ", being written"
                      : d.state === "failed"
                        ? ", needs another go"
                        : ", waiting"}
                </span>
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

/**
 * The icon: a page outline; lines appear and the pen nib moves along the
 * current line while writing; a tick while checking; pages stack while
 * assembling. Decorative (aria-hidden); the words carry the meaning.
 */
function PageIcon({
  phase,
  moving,
}: {
  phase: WritingStatus["phase"];
  moving: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 48 56"
      width="48"
      height="56"
      className="wi-icon shrink-0"
      data-phase={phase}
      data-moving={moving ? "true" : "false"}
      style={{ color: "var(--ink)" }}
    >
      <g className="wi-pages">
        <rect
          className="wi-page wi-page-back"
          x="9"
          y="2"
          width="30"
          height="40"
          rx="2"
          fill="var(--mist)"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <rect
          className="wi-page"
          x="4"
          y="8"
          width="30"
          height="40"
          rx="2"
          fill="var(--paper)"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </g>
      <g
        className="wi-lines"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <line className="wi-line" x1="9" y1="18" x2="27" y2="18" />
        <line className="wi-line" x1="9" y1="24" x2="29" y2="24" />
        <line className="wi-line" x1="9" y1="30" x2="25" y2="30" />
        <line className="wi-line" x1="9" y1="36" x2="28" y2="36" />
      </g>
      <path
        className="wi-tick"
        d="M12 30 L18 36 L29 22"
        fill="none"
        stroke="var(--moss)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g
        className="wi-pen"
        stroke="var(--ochre)"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <line x1="30" y1="46" x2="42" y2="30" />
        <line x1="29" y1="47" x2="31" y2="44" stroke="currentColor" />
      </g>
    </svg>
  );
}
