import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { RETENTION_DAYS } from "@/server/accounts/purge";

export const metadata: Metadata = { title: "Account deleted" };

export default function AccountDeletedPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-semibold tracking-tight">
        Your account was deleted
      </h1>
      <p className="text-ink mt-3 leading-7">
        You have been signed out of every device and sign-in for this account is
        refused from now on. The data is hidden immediately and permanently
        removed after {RETENTION_DAYS} days. A confirmation has been sent to
        your email address, and another will follow when the removal happens.
      </p>
      <p className="text-ink mt-4 leading-7">
        If this was a mistake, reply to the confirmation email before the
        removal date. {BRAND} keeps no participant information, so nothing about
        the people you support is affected.
      </p>
      <p className="mt-6">
        <Link href="/" className="underline underline-offset-2">
          Back to the home page
        </Link>
      </p>
    </div>
  );
}
