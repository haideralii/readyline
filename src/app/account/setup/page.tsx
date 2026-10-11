import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/server/accounts/queries";
import { AccountForm } from "../account-form";

export const metadata: Metadata = { title: "About your business" };

export default async function AccountSetupPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=%2Faccount%2Fsetup");
  if (viewer.deleted) redirect("/account/deleted");
  if (viewer.account) redirect("/account");
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-semibold tracking-tight">
        About your business
      </h1>
      <p className="mt-3 leading-7 text-zinc-700 dark:text-zinc-300">
        This creates your account. If you started the questionnaire on this
        device, we have filled in what you told us and will move your draft to
        your account so you can continue from any device.
      </p>
      <AccountForm mode="setup" />
    </div>
  );
}
