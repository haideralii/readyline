"use client";
import { useEffect, useState } from "react";

export type JumpToItem = { id: string; text: string };

/**
 * REQ-028 FR-11 (default (b)): the "Jump to" nav of a reading page's aside
 * and the account page's in-page nav. The list and the headings are
 * server-rendered, so a reader without script has the links; with script
 * an `IntersectionObserver` on the headings re-reads their positions
 * whenever one crosses the 6 rem line the headings scroll to
 * (`scroll-mt-24`), and the last heading at or above that line is the
 * current section, marked `aria-current="location"` and underlined in
 * ochre. Nothing is current until a heading has reached the line. h2s
 * only (default (e)); no dependency, no network call.
 */
export function JumpTo({
  items,
  label = "Jump to",
  testId = "jump-to",
  className,
}: {
  items: readonly JumpToItem[];
  label?: string;
  testId?: string;
  className?: string;
}) {
  const [current, setCurrent] = useState<string | null>(null);
  const ids = items.map((i) => i.id).join(" ");
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const heads = ids
      .split(" ")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (heads.length === 0) return;
    const read = () => {
      let found: string | null = null;
      for (const el of heads)
        if (el.getBoundingClientRect().top <= 104) found = el.id;
      setCurrent(found);
    };
    const io = new IntersectionObserver(read, {
      rootMargin: "-96px 0px 0px 0px",
      threshold: [0, 1],
    });
    for (const el of heads) io.observe(el);
    read();
    return () => io.disconnect();
  }, [ids]);
  return (
    <nav aria-label={label} className={className} data-testid={testId}>
      <p className="text-slate text-sm font-medium">{label}</p>
      <ul className="mt-1 text-sm">
        {items.map((i) => {
          const isCurrent = i.id === current;
          return (
            <li key={i.id}>
              <a
                href={`#${i.id}`}
                aria-current={isCurrent ? "location" : undefined}
                className={[
                  "inline-flex min-h-11 items-center underline-offset-4 hover:underline",
                  isCurrent ? "decoration-ochre underline decoration-2" : null,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {i.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
