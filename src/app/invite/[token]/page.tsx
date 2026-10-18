import { PageShell } from "@/components/page-shell";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import {
  AUDITOR_TOKEN_PATTERN,
  hashAuditorToken,
} from "@/lib/registers/auditor-link";
import { INVITE_LINE } from "@/lib/registers/worker";
import { notFoundMetadata } from "@/lib/page-titles";
import { getViewer } from "@/server/accounts/queries";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { SupabaseEnvError } from "@/server/supabase/env";
import { AcceptInvitation } from "./accept";

export const dynamic = "force-dynamic";

type InvitePreview = { trading_name: string; worker_ref: string };

/** One lookup per request, shared by the title and the page (React cache). */
const invitePreviewFor = cache(
  async (token: string): Promise<InvitePreview | null> => {
    const r = await createSupabaseAdminClient().rpc("invitation_preview", {
      p_token_hash: hashAuditorToken(token),
    });
    return (r.data as InvitePreview[] | null)?.[0] ?? null;
  },
);

/** QA live b340ee3, B #57: the title follows `notFound()`. */
export async function generateMetadata({
  params,
}: PageProps<"/invite/[token]">): Promise<Metadata> {
  const { token } = await params;
  const known =
    AUDITOR_TOKEN_PATTERN.test(token) &&
    (await invitePreviewFor(token).then(
      (p) => p !== null,
      () => false,
    ));
  return known
    ? { title: "Your invitation", robots: { index: false, follow: false } }
    : notFoundMetadata;
}

/**
 * The invitation page (REQ-020 FR-4, FR-11): signed out, it says who invited
 * you and sends you to sign in with the invited address; signed in, one
 * button accepts. A used, revoked, expired or unknown token is a plain 404.
 */
export default async function InvitePage({
  params,
}: PageProps<"/invite/[token]">) {
  const { token } = await params;
  if (!AUDITOR_TOKEN_PATTERN.test(token)) notFound();
  let preview: InvitePreview | null = null;
  try {
    preview = await invitePreviewFor(token);
  } catch (e) {
    if (e instanceof SupabaseEnvError) notFound();
    throw e;
  }
  if (!preview) notFound();
  const viewer = await getViewer();
  if (viewer?.account) redirect("/account");
  return (
    <PageShell kind="reading">
      <h1 className="">{preview.trading_name} has invited you</h1>
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
    </PageShell>
  );
}
