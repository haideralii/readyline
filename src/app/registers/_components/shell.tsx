import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { LAPSE_MESSAGE } from "@/lib/registers/messages";
import { getViewer, type Viewer } from "@/server/accounts/queries";
import { hasActiveSubscription } from "@/server/registers/queries";
import { createSupabaseServerClient } from "@/server/supabase/server";

/**
 * Every register page starts here (REQ-009 FR-5, PO answer 4): a signed-in
 * owner with an account, the subscription state, and the one-line lapse
 * message when writes are frozen. Reads always work; the database refuses
 * writes on its own, this only hides the buttons.
 */
export type RegisterContext = {
  viewer: Viewer & { account: NonNullable<Viewer["account"]> };
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  canWrite: boolean;
};

export async function registerContext(next: string): Promise<RegisterContext> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  if (viewer.deleted) redirect("/account/deleted");
  if (!viewer.account) redirect("/account/setup");
  const supabase = await createSupabaseServerClient();
  const canWrite = await hasActiveSubscription(supabase, viewer.account.id);
  return {
    viewer: viewer as RegisterContext["viewer"],
    supabase,
    canWrite,
  };
}

export function RegisterPage({
  title,
  intro,
  canWrite,
  addHref,
  addLabel,
  exportHref,
  back,
  children,
}: {
  title: string;
  intro?: ReactNode;
  canWrite: boolean;
  addHref?: string;
  addLabel?: string;
  exportHref?: string;
  back?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      {back ? (
        <p className="text-sm">
          <Link
            href={back.href}
            className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
          >
            ‹ {back.label}
          </Link>
        </p>
      ) : null}
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      {intro ? (
        <p className="mt-3 leading-7 text-zinc-700 dark:text-zinc-300">
          {intro}
        </p>
      ) : null}
      {!canWrite ? (
        <p
          role="status"
          className="mt-4 rounded-md border border-zinc-300 bg-zinc-50 p-3 text-sm leading-6 dark:border-zinc-700 dark:bg-zinc-900"
          data-testid="register-lapsed"
        >
          {LAPSE_MESSAGE}
        </p>
      ) : null}
      {(canWrite && addHref) || exportHref ? (
        <div className="mt-5 flex flex-wrap gap-3">
          {canWrite && addHref ? (
            <Link
              href={addHref}
              className="btn-primary"
              data-testid="register-add"
            >
              {addLabel ?? "Add"}
            </Link>
          ) : null}
          {exportHref ? (
            <a
              href={exportHref}
              className="btn-secondary"
              data-testid="register-export"
            >
              Export CSV
            </a>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
