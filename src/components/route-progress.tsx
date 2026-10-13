"use client";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

/**
 * Navigation feedback (REQ-015 FR-14): a 2 px line runs across the top of
 * the page from the moment a same-site link is tapped until the next page
 * paints, and the tapped link keeps a pressed look (aria-busy) meanwhile, so
 * no tap looks ignored. Plain DOM events: the component subscribes to link
 * clicks on the document and clears when the URL changes. It reads only
 * the pathname (no `useSearchParams`), so the root layout needs no Suspense
 * boundary and a page that throws notFound() still answers 404.
 */
let pending = false;
let pendingAnchor: HTMLAnchorElement | null = null;
let startedAt = "";
const listeners = new Set<() => void>();

function set(next: boolean, anchor: HTMLAnchorElement | null = null) {
  pending = next;
  if (pendingAnchor && pendingAnchor !== anchor)
    pendingAnchor.removeAttribute("aria-busy");
  pendingAnchor = next ? anchor : null;
  if (anchor && next) anchor.setAttribute("aria-busy", "true");
  startedAt = next ? location.href : "";
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.("a");
    if (!(a instanceof HTMLAnchorElement)) return;
    if (a.target && a.target !== "_self") return;
    if (a.hasAttribute("download")) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.search === location.search)
      return; // an in-page anchor
    set(true, a);
  };
  document.addEventListener("click", onClick);
  return () => {
    listeners.delete(listener);
    document.removeEventListener("click", onClick);
  };
}

const getSnapshot = () => pending;
const getServerSnapshot = () => false;

export function RouteProgress() {
  const active = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const pathname = usePathname();
  // The new page has rendered: clear the line and the pressed link.
  useEffect(() => {
    set(false);
  }, [pathname]);
  // A same-path navigation (only the query changed) and a navigation that
  // never completes (offline) are cleared by watching the URL, with a cap.
  useEffect(() => {
    if (!active) return;
    const started = Date.now();
    const t = setInterval(() => {
      if (location.href !== startedAt || Date.now() - started > 15_000)
        set(false);
    }, 150);
    return () => clearInterval(t);
  }, [active]);
  if (!active) return null;
  return (
    <div
      role="progressbar"
      aria-label="Loading the next page"
      aria-valuetext="Loading"
      className="route-progress"
      data-testid="route-progress"
    >
      <div className="route-progress-bar" />
    </div>
  );
}
