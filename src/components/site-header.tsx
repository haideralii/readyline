import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { getSessionUser } from "@/server/accounts/queries";

export async function SiteHeader() {
  const user = await getSessionUser();
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {BRAND}
        </Link>
        <nav aria-label="Account" className="flex items-center gap-4 text-sm">
          <span className="rounded-full border border-zinc-300 px-2.5 py-0.5 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            In development
          </span>
          {user ? (
            <>
              <Link
                href="/checklist"
                className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
              >
                Checklist
              </Link>
              <Link
                href="/documents"
                className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
              >
                Documents
              </Link>
              <Link
                href="/account"
                className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
              >
                Account
              </Link>
            </>
          ) : (
            <Link
              href="/sign-in"
              className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
