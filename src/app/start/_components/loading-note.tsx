"use client";
import { useEffect, useState } from "react";

/** How long the loading state may stand before the page says something about it. */
export const LOADING_NOTE_AFTER_MS = 5_000;
export const LOADING_NOTE_TEXT =
  "Still loading. Reload the page if this stays.";

/**
 * Live QA pass of b340ee3, D8: twice in about twenty fresh loads a step
 * stayed in its disabled loading fieldset past 20 s with nothing on the
 * page saying why (unconfirmed, likely the test proxy). Rather than hunt
 * it, the loading state gets a line after five seconds, so nobody is left
 * with a dead form and no word. Unmounts with the loading state.
 */
export function LoadingNote({
  afterMs = LOADING_NOTE_AFTER_MS,
}: {
  afterMs?: number;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setShown(true), afterMs);
    return () => window.clearTimeout(id);
  }, [afterMs]);
  if (!shown) return null;
  return (
    <p
      role="status"
      className="text-slate mt-4 text-sm leading-6"
      data-testid="loading-note"
    >
      {LOADING_NOTE_TEXT}
    </p>
  );
}
