import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { isProductionDeployment } from "@/lib/env";
import { Wordmark } from "@/components/wordmark";
import { getSessionUser } from "@/server/accounts/queries";

/** Nav links: a 44 px target, a visible pressed state, never split across lines. */
const navLink =
  "inline-flex min-h-11 items-center px-1 underline-offset-4 hover:underline active:bg-mist active:underline";

export async function SiteHeader() {
  const user = await getSessionUser();
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
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
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 sm:px-6 sm:py-3">
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
            className="order-3 rounded-full border border-zinc-300 px-2.5 py-0.5 text-xs whitespace-nowrap text-zinc-600 sm:order-none dark:border-zinc-700 dark:text-zinc-400"
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
          {user ? (
            <>
              <Link href="/checklist" className={navLink}>
                Checklist
              </Link>
              <Link href="/registers" className={navLink}>
                Registers
              </Link>
              <Link href="/documents" className={navLink}>
                Documents
              </Link>
              <Link href="/account" className={navLink}>
                Account
              </Link>
            </>
          ) : (
            <Link href="/sign-in" className={navLink}>
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
