import { PageShell } from "@/components/page-shell";
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
import { SUBSCRIPTION_OFF } from "@/lib/payments/copy";
import { subscriptionAvailable } from "@/server/payments/stripe";
import { getSubscription } from "@/server/payments/subscription-queries";
import { createSupabaseServerClient } from "@/server/supabase/server";
import {
  PAUSED_EXPORT_SENTENCE,
  TIMELINE_FIXED_SENTENCE,
  midtermFor,
  positionSentence,
  timelineRows,
} from "@/lib/registers/timeline";
import type { RegistrationKind } from "@/lib/registers/types";
import { loadQuestionnaire } from "@/server/path/state";
import { currentPeriod } from "@/server/registers/registration-queries";
import { AccountForm } from "./account-form";
import { DeleteAccountForm } from "./delete-account-form";
import { RegistrationForm } from "./registration-form";
import { RegistrationTimeline } from "./registration-timeline";
import { BillingPortalButton, SubscribeButton } from "./subscribe-button";
import { AuditorLinkPanel } from "./auditor-link";
import { TeamPanel } from "./team";
import { latestAuditorLink, liveLink } from "@/server/registers/auditor-links";
import {
  listInvitations,
  listWorkers,
  liveReportLink,
  pendingInvitations,
} from "@/server/registers/team-queries";

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
  const [
    purchases,
    overview,
    subscription,
    subscribed,
    dueSoon,
    facts,
    period,
    questionnaire,
    kindRow,
  ] = await Promise.all([
    listPurchases(supabase, a.id),
    registerOverview(supabase, a.id),
    getSubscription(supabase, a.id),
    hasActiveSubscription(supabase, a.id),
    // Batch 45 item 5: every notify-by and review date inside 30 days from the live rows, the incident first.
    dueSoonForAccount(supabase, a, today),
    loadFacts(supabase, a.id),
    // REQ-023 FR-1, FR-2: the current period, the questionnaire's reading for the mid-term rule, the mirrored audit type.
    currentPeriod(supabase, a.id),
    loadQuestionnaire(),
    supabase
      .from("accounts")
      .select("registration_kind")
      .eq("id", a.id)
      .maybeSingle(),
  ]);
  const mirroredKind =
    (kindRow.data as { registration_kind: RegistrationKind | null } | null)
      ?.registration_kind ?? null;
  const registrationInitial = period
    ? {
        id: period.id,
        periodStartsOn: period.period_starts_on,
        periodEndsOn: period.period_ends_on,
        auditType: period.audit_type,
        midtermStartByOverride: period.midterm_start_by_override ?? "",
        midtermOverrideSource: period.midterm_override_source ?? ("" as const),
        lastAuditOn: period.last_audit_on ?? "",
        midtermAuditOn: period.midterm_audit_on ?? "",
      }
    : {
        // D-2312: pre-filled from the accounts columns where set, else from the result; both editable.
        periodStartsOn: a.registration_date ?? "",
        periodEndsOn: "",
        auditType:
          mirroredKind ?? questionnaire.result?.pathway ?? "certification",
        midtermStartByOverride: "",
        midtermOverrideSource: "" as const,
        lastAuditOn: "",
        midtermAuditOn: "",
      };
  const midterm = period
    ? { applies: period.midterm_applies, reason: period.midterm_exempt_reason }
    : questionnaire.result
      ? midtermFor(
          registrationInitial.auditType,
          questionnaire.result.midTermAudit,
        )
      : null;
  const registers = registersLine(overview);
  const pricing = readPricing();
  const subscriptionOffered = subscriptionAvailable();
  const auditorLink = liveLink(await latestAuditorLink(supabase, a.id));
  // REQ-020 FR-4, FR-5: the team and the report link, read by code only.
  const [invitations, workers, reportLink] = await Promise.all([
    listInvitations(supabase, a.id),
    listWorkers(supabase, a.id),
    liveReportLink(supabase, a.id),
  ]);
  return (
    <PageShell kind="grid">
      <h1 className="text-3xl font-semibold tracking-tight">Your account</h1>
      <p className="text-ink mt-3 leading-7">
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
        <p className="text-ink mt-2 text-sm leading-6">
          {registers.sentence}{" "}
          <Link href="/registers" className="underline underline-offset-2">
            Open the registers
          </Link>
          .
        </p>
        {/* REQ-009 FR-3: the same rows the reminder emails are sent from. */}
        <h3 className="mt-4 text-base font-semibold">Due soon</h3>
        {dueSoon.length === 0 ? (
          <p className="text-slate mt-1 text-sm" data-testid="due-soon-empty">
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
                {d.sent ? <span className="text-slate"> (emailed)</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* REQ-023 FR-1, FR-2: the dates from the certificate, the timeline the product derives, the one sentence that says which rules. */}
      <section
        aria-labelledby="registration-heading"
        className="mt-8"
        data-testid="account-registration"
      >
        <h2 id="registration-heading" className="text-xl font-semibold">
          Your registration
        </h2>
        <p className="text-ink mt-2 text-sm leading-6">
          Type the dates from your certificate of registration. We work out the
          mid-term audit and renewal dates from them and remind you by email.
        </p>
        <RegistrationForm
          initial={registrationInitial}
          midterm={midterm}
          questionnaireDone={Boolean(questionnaire.result)}
        />
        {period ? (
          <>
            <h3 className="mt-6 text-base font-semibold">
              Your registration timeline
            </h3>
            <RegistrationTimeline
              rows={timelineRows(period)}
              caption="Your registration timeline"
              testId="registration-timeline"
            />
            <p
              className="mt-3 text-sm leading-6"
              data-testid="registration-position"
            >
              {positionSentence(period, today)}
            </p>
            <p
              className="text-slate mt-2 text-sm leading-6"
              data-testid="registration-fixed-sentence"
            >
              {TIMELINE_FIXED_SENTENCE}
            </p>
            <p className="mt-2 text-sm leading-6">
              <a
                href="/registers/audit-pack.zip"
                className="underline underline-offset-2"
                data-testid="registration-pack-link"
              >
                Download your audit pack (every register)
              </a>
              : a provider who ceases to be registered must keep its records for
              three years from that day (NDIS Act s 73R).
            </p>
          </>
        ) : null}
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
        {/* Retro finding 59: the link is the provider's own disclosure, so the copy says what the view holds, not less. */}
        <p className="text-ink mt-2 text-sm leading-6">
          A link that opens your registers, your document control register and
          your audit pack, read-only. It expires when you say and you can revoke
          it at any time. You copy it and send it yourself; we send nothing and
          we do not list or recommend auditors.
        </p>
        <p
          className="text-ink mt-2 text-sm leading-6"
          data-testid="auditor-link-disclosure"
        >
          Participants appear as the codes you typed. Everything you typed into
          a register is in the view exactly as you typed it, so check your
          summaries and notes for names, and for any worker named in a note,
          before you share.
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

      {/* REQ-020 FR-4, FR-5, FR-11: the workers who log for you and the report link. */}
      <section
        aria-labelledby="team-heading"
        className="mt-8"
        data-testid="account-team"
      >
        <h2 id="team-heading" className="text-xl font-semibold">
          Your team
        </h2>
        <TeamPanel
          invitations={pendingInvitations(invitations).map((i) => ({
            id: i.id,
            workerRef: i.worker_ref,
            expiresAt: i.expires_at,
          }))}
          workers={workers.map((w) => ({
            userId: w.user_id,
            workerRef: w.worker_ref,
            since: w.created_at,
          }))}
          reportLink={
            reportLink
              ? { id: reportLink.id, createdAt: reportLink.created_at }
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
              className="text-ink mt-2 text-sm leading-6"
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
              className="text-ink mt-2 text-sm leading-6"
              data-testid="subscription-status"
            >
              {subscription
                ? "Your subscription has lapsed; your records are safe and read-only. Renew to add to them."
                : "Not subscribed. The registers are read-only without a subscription."}
            </p>
            {subscription ? (
              // REQ-023 FR-2 (findings 40, 66, 85): the s 73Q records outlive the payment; the pack holds every register.
              <p
                className="text-ink mt-2 text-sm leading-6"
                data-testid="paused-export"
              >
                {PAUSED_EXPORT_SENTENCE}{" "}
                <a
                  href="/registers/audit-pack.zip"
                  className="underline underline-offset-2"
                >
                  Download your audit pack
                </a>
                .
              </p>
            ) : null}
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
                className="text-slate mt-2 text-sm"
                data-testid="subscription-off"
              >
                {SUBSCRIPTION_OFF}
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
        <p className="text-ink mt-2 text-sm leading-6">
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
          <p className="text-ink mt-2 text-sm leading-6">
            No purchases yet.{" "}
            <Link href="/pricing" className="underline underline-offset-2">
              See the document pack
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-rule mt-3 divide-y" data-testid="purchases">
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
                  <span className="text-slate">
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
    </PageShell>
  );
}
