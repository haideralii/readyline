import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AUDITOR_TOKEN_PATTERN, hashAuditorToken } from "@/lib/registers/auditor-link";
import { INVITE_LINE } from "@/lib/registers/worker";
import { getViewer } from "@/server/accounts/queries";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { SupabaseEnvError } from "@/server/supabase/env";
import { AcceptInvitation } from "./accept";

export const metadata: Metadata = {
  title: "Your invitation",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * The invitation page (REQ-020 FR-4, FR-11): signed out, it says who invited
 * you and sends you to sign in with the invited address; signed in, one
 * button accepts. A used, revoked, expired or unknown token is a plain 404.
 */
export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  if (!AUDITOR_TOKEN_PATTERN.test(token)) notFound();
  let preview: { trading_name: string; worker_ref: string } | null = null;
  try {
    const admin = createSupabaseAdminClient();
    const r = await admin.rpc("invitation_preview", { p_token_hash: hashAuditorToken(token) });
    preview = (r.data as { trading_name: string; worker_ref: string }[] | null)?.[0] ?? null;
  } catch (e) {
    if (e instanceof SupabaseEnvError) notFound();
    throw e;
  }
  if (!preview) notFound();
  const viewer = await getViewer();
  if (viewer?.account) redirect("/account");
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-semibold tracking-tight">
        {preview.trading_name} has invited you
      </h1>
      <p className="mt-3 leading-7" data-testid="invite-line">
        You would log as worker {preview.worker_ref}. {INVITE_LINE}
      </p>
      {viewer ? (
        <AcceptInvitation token={token} />
      ) : (
        <p className="mt-6">
          <Link
            href={`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`}
            className="btn-primary"
            data-testid="invite-sign-in"
          >
            Sign in with the email this was sent to
          </Link>
        </p>
      )}
    </div>
  );
}
