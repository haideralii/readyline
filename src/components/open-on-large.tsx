"use client";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type DetailsHTMLAttributes,
  type ReactNode,
} from "react";

/**
 * REQ-028 D-2813 (as amended 17 Oct 06:10): "open on `lg`" is this one client
 * component, a `<details>` that owns its `open` state. It opens on mount when
 * `matchMedia("(min-width: 1024px)")` matches, opens again on a change only
 * when the viewport crosses into `lg` (a reader who closed a section keeps
 * it closed), and follows the person's own toggle through `onToggle`. A
 * caller with a remembered value for the section (the result's three
 * sections, REQ-013 FR-7, `useRememberedOpen`) passes the controlled
 * `open` and `onToggle` pair, and that value wins: the mount rule applies
 * only on a first visit with nothing remembered. The server renders closed;
 * the one-time shift at `lg` is inside the right column (AC-10's CLS).
 * FR-13's `Disclosure` renders through this when its `openOnLarge` prop is
 * set and through a plain `<details>` otherwise. One render, no second
 * heading, no dependency; unused until Sessions A2 and C.
 *
 * The media query is read through `useSyncExternalStore` (the D-1012 pattern:
 * no setState inside an effect); the person's own choice, once made, sits
 * over it, and only a crossing of `lg` touches that choice.
 */
export const LARGE = "(min-width: 1024px)";

function subscribe(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(LARGE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const getSnapshot = () =>
  typeof window !== "undefined" && !!window.matchMedia
    ? window.matchMedia(LARGE).matches
    : false;
const getServerSnapshot = () => false;

export function OpenOnLarge({
  open: controlled,
  onToggle,
  children,
  ...rest
}: {
  /** The remembered value, when the caller has one; it wins over the mount rule. */
  open?: boolean;
  /** Called with the new value on the person's toggle. */
  onToggle?: (open: boolean) => void;
  children: ReactNode;
} & Omit<DetailsHTMLAttributes<HTMLDetailsElement>, "open" | "onToggle">) {
  const large = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // The person's own choice; undefined until they toggle or the viewport leaves lg.
  const [own, setOwn] = useState<boolean | undefined>(undefined);
  const isControlled = controlled !== undefined;
  const open = isControlled ? controlled : (own ?? large);

  useEffect(() => {
    if (isControlled || typeof window === "undefined" || !window.matchMedia)
      return;
    const mq = window.matchMedia(LARGE);
    let was = mq.matches;
    const onChange = (e: MediaQueryListEvent) => {
      // Crossing into lg opens a closed section once: the live value takes over.
      if (e.matches && !was) setOwn(undefined);
      // Leaving lg changes nothing: what is shown now is kept.
      else if (!e.matches && was) setOwn((o) => o ?? true);
      was = e.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [isControlled]);

  return (
    <details
      {...rest}
      open={open}
      onToggle={(e) => {
        const next = (e.currentTarget as HTMLDetailsElement).open;
        if (next === open) return;
        if (!isControlled) setOwn(next);
        onToggle?.(next);
      }}
    >
      {children}
    </details>
  );
}
