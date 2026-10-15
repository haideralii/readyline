import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type {
  BusinessStructureAnswer,
  State,
} from "@/lib/questionnaire/schema";
import { ConfirmButton } from "@/components/confirm-button";
import { ReadyLine } from "@/components/ready-line";
import { formatAud, readPricing } from "@/lib/payments/pricing";
import { registersLine } from "@/lib/registers/overview";
import { dueSoonForAccount } from "@/server/registers/due-soon";
import {
  hasActiveSubscription,
  registerOverview,
} from "@/server/registers/queries";
import { getViewer } from "@/server/accounts/queries";
import { signOut, signOutEverywhere } from "@/server/auth/actions";
import { loadFacts } from "@/server/path/facts";
import { listPurchases } from "@/server/payments/queries";
import { subscriptionAvailable } from "@/server/payments/stripe";
import { getSubscription } from "@/server/payments/subscription-queries";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { AccountForm } from "./account-form";
import { DeleteAccountForm } from "./delete-account-form";
import { BillingPortalButton, SubscribeButton } from "./subscribe-button";
import { AuditorLinkPanel } from "./auditor-link";
import { latestAuditorLink, liveLink } from "@/server/registers/auditor-links";

export const metadata: Metadata = { title: "Your account" };

const secondaryButton = "btn-secondary";

export default async function AccountPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=%2Faccount");
  if (viewer.deleted) redirect("/account/deleted");
  if (!viewer.account) redirect("/account/setup");
  const a = viewer.account;
  // REQ-007 FR-7: the purchase rows with their receipt links.
  const supabase = await createSupabaseServerClient();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [purchases, overview, subscription, subscribed, dueSoon, facts] =
    await Promise.all([
      listPurchases(supabase, a.id),
      registerOverview(supabase, a.id),
      getSubscription(supabase, a.id),
      hasActiveSubscription(supabase, a.id),
      // Batch 45 item 5: every notify-by and review date inside 30 days from the live rows, the incident first.
      dueSoonForAccount(supabase, a, today),
      loadFacts(supabase, a.id),
    ]);
  const registers = registersLine(overview);
  const pricing = readPricing();
  const subscriptionOffered = subscriptionAvailable();
  const auditorLink = liveLink(await latestAuditorLink(supabase, a.id));
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

      {/* REQ-009 batch 28 item 4: the registers' state on the ready line, with the overdue counts in words. */}
      <section
        aria-labelledby="registers-heading"
        className="mt-8"
        data-testid="account-registers"
      >
        <h2 id="registers-heading" className="text-xl font-semibold">
          Registers
        </h2>
        <div className="mt-3">
          <ReadyLine
            counts={{
              done: registers.current,
              todo: registers.dueSoon + registers.overdue,
            }}
            noun="register entries"
            testId="account-registers-line"
          />
        </div>
        <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          {registers.sentence}{" "}
          <Link href="/registers" className="underline underline-offset-2">
            Open the registers
          </Link>
          .
        </p>
        {/* REQ-009 FR-3: the same rows the reminder emails are sent from. */}
        <h3 className="mt-4 text-base font-semibold">Due soon</h3>
        {dueSoon.length === 0 ? (
          <p
            className="mt-1 text-sm text-zinc-600 dark:text-zinc-400"
            data-testid="due-soon-empty"
          >
            Nothing due in the next 30 days.
          </p>
        ) : (
          <ul
            className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6"
            data-testid="due-soon"
          >
            {dueSoon.map((d) => (
              <li key={d.id}>
                {d.line}
                {d.sent ? (
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {" "}
                    (emailed)
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* REQ-020 FR-2, FR-3: one read-only auditor link at a time; the owner sends it, Readyline never does. */}
      <section
        aria-labelledby="auditor-heading"
        className="mt-8"
        data-testid="account-auditor-link"
      >
        <h2 id="auditor-heading" className="text-xl font-semibold">
          Share a read-only view with your auditor
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          A link that opens your registers, your document control register and
          your audit pack, read-only, with participants shown as codes only. It
          expires when you say and you can revoke it at any time. You copy it
          and send it yourself; we send nothing and we do not list or recommend
          auditors.
        </p>
        <AuditorLinkPanel
          current={
            auditorLink
              ? {
                  id: auditorLink.id,
                  expiresAt: auditorLink.expires_at,
                  lastOpenedAt: auditorLink.last_opened_at,
                  openedCount: auditorLink.opened_count,
                }
              : null
          }
        />
      </section>

      {/* REQ-009 Session C: the registers subscription, its state and the billing portal. */}
      <section
        aria-labelledby="subscription-heading"
        className="mt-8"
        data-testid="account-subscription"
      >
        <h2 id="subscription-heading" className="text-xl font-semibold">
          Registers subscription
        </h2>
        {subscribed ? (
          <>
            <p
              className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300"
              data-testid="subscription-status"
            >
              {subscription?.status === "past_due"
                ? "Active. Your last payment did not go through; Stripe is retrying. Update your card below if it keeps failing. Your records stay open meanwhile."
                : `Active. ${pricing.subscriptionPriceCents ? `${formatAud(pricing.subscriptionPriceCents)} a month, ` : ""}cancel at any time; no fee, no notice period.`}
            </p>
            <BillingPortalButton />
          </>
        ) : (
          <>
            <p
              className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300"
              data-testid="subscription-status"
            >
              {subscription
                ? "Your subscription has lapsed; your records are safe and read-only. Renew to add to them."
                : "Not subscribed. The registers are read-only without a subscription."}
            </p>
            {subscriptionOffered ? (
              <SubscribeButton
                label={
                  pricing.subscriptionPriceCents
                    ? `Subscribe for ${formatAud(pricing.subscriptionPriceCents)} a month`
                    : "Subscribe to the registers"
                }
                cancelPath="/account"
              />
            ) : (
              <p
                className="mt-2 text-sm text-zinc-600 dark:text-zinc-400"
                data-testid="subscription-coming"
              >
                Subscriptions open soon.
              </p>
            )}
          </>
        )}
      </section>

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
            ownerName: facts.name ?? "",
            ownerRole: facts.role ?? "",
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
            {/* REQ-015 FR-15: a destructive action asks first. */}
            <ConfirmButton
              label="Sign out of all devices"
              question="Sign out of every device, including this one?"
              confirmLabel="Yes, sign out everywhere"
              submit
              testId="sign-out-everywhere"
            />
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

      <section aria-labelledby="purchases-heading" className="mt-10">
        <h2 id="purchases-heading" className="text-xl font-semibold">
          Purchases
        </h2>
        {purchases.length === 0 ? (
          <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            No purchases yet.{" "}
            <Link href="/pricing" className="underline underline-offset-2">
              See the document pack
            </Link>
            .
          </p>
        ) : (
          <ul
            className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800"
            data-testid="purchases"
          >
            {purchases.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-1 py-3 text-sm leading-6 sm:flex-row sm:items-center sm:justify-between"
              >
                <span>
                  Document pack, {formatAud(p.amountCents)},{" "}
                  {new Date(p.createdAt).toLocaleDateString("en-AU", {
                    timeZone: "Australia/Sydney",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                  {p.status === "refunded" ? " (refunded)" : ""}
                </span>
                {p.receiptUrl ? (
                  <a
                    href={p.receiptUrl}
                    className="underline underline-offset-2"
                    rel="noopener noreferrer"
                  >
                    View receipt
                  </a>
                ) : (
                  <span className="text-zinc-600 dark:text-zinc-400">
                    Receipt by email from Stripe
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
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
