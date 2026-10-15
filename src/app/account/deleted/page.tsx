import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { contactEmail } from "@/lib/legal/config";
import { RETENTION_DAYS } from "@/server/accounts/purge";

export const metadata: Metadata = { title: "Account deleted" };

/**
 * No email is promised here: the provider is log-only until D-013 is
 * settled (retro review of REQ-004, 15 Oct 2026, fix 31a). The page says
 * what the app does and how to reach us; the contact address appears when
 * `CONTACT_EMAIL` is set, as in the footer.
 */
export default function AccountDeletedPage() {
  const email = contactEmail();
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-semibold tracking-tight">
        Your account was deleted
      </h1>
      <p className="mt-3 leading-7 text-zinc-700 dark:text-zinc-300">
        You are signed out on every device and this account can no longer sign
        in. We hide the data now and permanently remove it after{" "}
        {RETENTION_DAYS} days.
      </p>
      <p className="mt-4 leading-7 text-zinc-700 dark:text-zinc-300">
        If this was a mistake,{" "}
        {email ? (
          <>
            email{" "}
            <a
              href={`mailto:${email}`}
              className="underline underline-offset-2"
            >
              {email}
            </a>
          </>
        ) : (
          "contact us"
        )}{" "}
        before then and tell us the trading name. {BRAND} keeps no participant
        information, so nothing about the people you support is affected.
      </p>
      <p className="mt-6">
        <Link href="/" className="underline underline-offset-2">
          Back to the home page
        </Link>
      </p>
    </div>
  );
}
