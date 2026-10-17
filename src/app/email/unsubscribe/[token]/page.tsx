import { PageShell } from "@/components/page-shell";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UNSUBSCRIBE_TOKEN_PATTERN } from "@/lib/email/unsubscribe-token";
import { BRAND } from "@/lib/brand";
import { unsubscribeByToken } from "@/server/email/reminder-settings";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { SupabaseEnvError } from "@/server/supabase/env";

export const metadata: Metadata = {
  title: "Reminder emails stopped",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * The one-click unsubscribe on a reminder email (REQ-022 FR-7, SR-6): the
 * token's hash finds the account, do_not_send is set, one audit line is
 * written, and this page says so; a second click says the same. An unknown
 * or malformed token is a plain 404. The trading name is shown only when
 * the account has one (a sole trader may not): else "for your account"
 * (PO, 17 Oct 2026 23:10).
 */
export default async function UnsubscribePage({
  params,
}: PageProps<"/email/unsubscribe/[token]">) {
  const { token } = await params;
  if (!UNSUBSCRIBE_TOKEN_PATTERN.test(token)) notFound();
  let result: Awaited<ReturnType<typeof unsubscribeByToken>>;
  try {
    result = await unsubscribeByToken(createSupabaseAdminClient(), token);
  } catch (e) {
    if (e instanceof SupabaseEnvError) notFound();
    throw e;
  }
  if (!result.ok) notFound();
  const whose = result.tradingName
    ? `for ${result.tradingName}`
    : "for your account";
  return (
    <PageShell kind="reading">
      <h1 className="">Reminder emails stopped</h1>
      <p className="text-ink mt-3 leading-7" data-testid="unsubscribe-line">
        You will get no more reminder emails from {BRAND} {whose}. The registers
        and their dates stay as they are; nothing else changes.
      </p>
      <p className="text-ink mt-3 leading-7">
        To turn the reminders back on, sign in and change it on your account
        page.
      </p>
      <p className="mt-6">
        <Link href="/account" className="btn-secondary">
          Go to your account
        </Link>
      </p>
    </PageShell>
  );
}
