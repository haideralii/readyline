import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type {
  BusinessStructureAnswer,
  State,
} from "@/lib/questionnaire/schema";
import { getViewer } from "@/server/accounts/queries";
import { signOut, signOutEverywhere } from "@/server/auth/actions";
import { AccountForm } from "./account-form";
import { DeleteAccountForm } from "./delete-account-form";

export const metadata: Metadata = { title: "Your account" };

const secondaryButton =
  "inline-flex min-h-12 items-center justify-center rounded-md border border-zinc-300 px-5 text-base font-medium hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-zinc-700 dark:hover:bg-zinc-900";

export default async function AccountPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=%2Faccount");
  if (viewer.deleted) redirect("/account/deleted");
  if (!viewer.account) redirect("/account/setup");
  const a = viewer.account;
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-semibold tracking-tight">Your account</h1>
      <p className="mt-3 leading-7 text-zinc-700 dark:text-zinc-300">
        Signed in as the owner of <strong>{a.trading_name}</strong>.{" "}
        <Link href="/start" className="underline underline-offset-2">
          Continue the questionnaire
        </Link>
        .
      </p>

      <section aria-labelledby="details-heading" className="mt-8">
        <h2 id="details-heading" className="text-xl font-semibold">
          Business details
        </h2>
        <AccountForm
          mode="settings"
          initial={{
            tradingName: a.trading_name,
            structure: a.business_structure as BusinessStructureAnswer,
            states: a.states as State[],
            abn: a.abn ?? "",
          }}
        />
      </section>

      <section aria-labelledby="session-heading" className="mt-10">
        <h2 id="session-heading" className="text-xl font-semibold">
          Sessions
        </h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <form action={signOut}>
            <button type="submit" className={secondaryButton}>
              Sign out
            </button>
          </form>
          <form action={signOutEverywhere}>
            <button type="submit" className={secondaryButton}>
              Sign out of all devices
            </button>
          </form>
        </div>
      </section>

      <section aria-labelledby="data-heading" className="mt-10">
        <h2 id="data-heading" className="text-xl font-semibold">
          Your data
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          Download everything stored for this account as a zip of JSON files.
          Nothing about participants is stored here; the export holds your
          business details, questionnaire draft and account history only.
        </p>
        <a
          href="/account/export"
          className={`${secondaryButton} mt-3`}
          data-testid="export-link"
        >
          Export my data (zip)
        </a>
      </section>

      <section aria-labelledby="delete-heading" className="mt-10">
        <h2 id="delete-heading" className="text-xl font-semibold">
          Delete this account
        </h2>
        <DeleteAccountForm tradingName={a.trading_name} />
      </section>
    </div>
  );
}
