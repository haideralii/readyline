"use client";
/**
 * REQ-028 FR-13 (D-2274; SR-2's client list): the header's links, the current
 * section underlined in ochre. The header stays a server component; this is
 * the one client piece in it, reading the pathname and nothing else.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavLinkItem = { href: string; label: string; testId?: string };

const base =
  "inline-flex min-h-11 items-center px-1 underline-offset-4 hover:underline active:bg-mist active:underline";

/** A section is current when the path is the link or sits under it. */
export function isCurrentSection(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({ links }: { links: readonly NavLinkItem[] }) {
  const pathname = usePathname() ?? "";
  return (
    <>
      {links.map((l) => {
        const current = isCurrentSection(pathname, l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={
              current ? `${base} decoration-ochre underline decoration-2` : base
            }
            aria-current={current ? "page" : undefined}
            data-testid={l.testId}
          >
            {l.label}
          </Link>
        );
      })}
    </>
  );
}
