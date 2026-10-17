import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { isProductionDeployment } from "@/lib/env";
import { NavLinks, type NavLinkItem } from "@/components/nav-links";
import { Wordmark } from "@/components/wordmark";
import { getSessionUser, getViewer } from "@/server/accounts/queries";

/** Nav links: a 44 px target, a visible pressed state, never split across lines. */
export async function SiteHeader() {
  const user = await getSessionUser();
  // REQ-020 FR-4: a worker's nav is their home alone; the owner's links would
  // only bounce them back there. One cached read per request (D-1012).
  const viewer = user ? await getViewer() : null;
  const worker = Boolean(viewer && !viewer.account && viewer.worker);
  // REQ-028 FR-13 (D-2274): the links as data; NavLinks underlines the current section.
  const links: NavLinkItem[] = worker
    ? [{ href: "/worker", label: "Your entries", testId: "nav-worker" }]
    : user
      ? [
          { href: "/checklist", label: "Checklist" },
          { href: "/registers", label: "Registers" },
          { href: "/documents", label: "Documents" },
          { href: "/account", label: "Account" },
        ]
      : [{ href: "/sign-in", label: "Sign in" }];
  return (
    <header className="border-rule border-b">
      {/*
       * REQ-015 FR-16a: this row was the shared cause of the sideways scroll
       * on phones. Signed in, the badge plus three links ran to 438 px on a
       * 402 px screen and the page panned on every page. The row now wraps
       * as blocks: the wordmark, then the badge (previews only) and the nav
       * as one unit that drops under the logo when it does not fit. A link
       * never splits across lines (FR-16); with four links at a large text
       * size the nav itself wraps whole links onto a second row rather than
       * widening the page (the signed-in width check at 360 px and 130 %).
       */}
      <div
        data-shell="header"
        className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 sm:px-6 sm:py-3 lg:px-8"
      >
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-xl focus-visible:outline-2 focus-visible:outline-offset-2"
          aria-label={`${BRAND} home`}
        >
          <Wordmark />
        </Link>
        {/* Previews and local runs only (batch 26 item 6): trial providers on production never see it. */}
        {isProductionDeployment() ? null : (
          <span
            className="border-line text-slate order-3 rounded-full border px-2.5 py-0.5 text-sm whitespace-nowrap sm:order-none"
            data-testid="dev-badge"
          >
            In development
          </span>
        )}
        <nav
          aria-label="Account"
          className="ml-auto flex flex-wrap items-center justify-end gap-x-3 text-sm whitespace-nowrap sm:gap-x-4"
          data-testid="site-nav"
        >
          <NavLinks links={links} />
        </nav>
      </div>
    </header>
  );
}
