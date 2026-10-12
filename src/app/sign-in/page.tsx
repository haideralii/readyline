import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/server/accounts/queries";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const viewer = await getViewer();
  if (viewer?.deleted) redirect("/account/deleted");
  if (viewer) redirect(viewer.account ? "/account" : "/account/setup");
  const params = await searchParams;
  const linkError = params.error === "link";
  const next = typeof params.next === "string" ? params.next : undefined;
  return (
    <div className="mx-auto w-full max-w-md px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-3 leading-7 text-zinc-700 dark:text-zinc-300">
        We email you a link; there is no password. Use the address you want your
        account under.
      </p>
      {linkError ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-amber-700 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-100"
        >
          The link has expired or was already used. Request a new one below; the
          new link works on any device.
        </p>
      ) : null}
      <SignInForm next={next} />
    </div>
  );
}
