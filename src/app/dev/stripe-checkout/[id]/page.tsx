import { PageShell } from "@/components/page-shell";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { decodeFakeSession } from "@/lib/payments/fake-session";
import { formatAud } from "@/lib/payments/pricing";
import { readStripeEnv, StripeEnvError } from "@/server/payments/stripe";

export const metadata: Metadata = { title: "Fake checkout (test only)" };

/**
 * Stands in for Stripe Checkout in fake mode only (REQ-007 Q5, D-709): 404
 * everywhere else. No card fields exist here or anywhere in Readyline; the
 * page has a Pay button, a Cancel link and, for testing the refund path, a
 * Refund button. `?receipt=1` is where the fake receipt URL points.
 */
export default async function FakeCheckoutPage({
  params,
  searchParams,
}: PageProps<"/dev/stripe-checkout/[id]">) {
  let env;
  try {
    env = readStripeEnv();
  } catch (e) {
    if (e instanceof StripeEnvError) notFound();
    throw e;
  }
  if (!env.fake) notFound();
  const { id } = await params;
  const sp = await searchParams;
  const data = decodeFakeSession(id, env.webhookSecret);
  if (!data) notFound();
  const receipt = sp.receipt === "1";
  // REQ-009 Session C: a subscription session shows the subscription buttons; `?portal=1` is the fake billing portal.
  const subscription = data.mode === "subscription";
  const portal = sp.portal === "1";
  // Batch 45b item 2: a plain form post answered with a 303 (./act/route.ts),
  // so the return is a full page load, as Stripe's own return is.
  const act = `/dev/stripe-checkout/${encodeURIComponent(id)}/act`;
  const button =
    "inline-flex min-h-12 items-center justify-center rounded-md bg-ink px-5 text-base font-medium text-paper focus-visible:outline-2 focus-visible:outline-offset-2";
  const secondary =
    "inline-flex min-h-12 items-center justify-center rounded-md border border-line px-5 text-base font-medium hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2";

  return (
    <PageShell kind="form">
      <p className="rounded-md border border-amber-700 bg-amber-50 p-3 text-sm leading-6 text-amber-900 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-200">
        Test environment only. This page stands in for Stripe Checkout; no
        payment is taken and no card details are asked for.
      </p>
      <h1 className="mt-6">
        {receipt
          ? "Fake receipt"
          : portal
            ? "Fake billing portal"
            : subscription
              ? "Fake subscription checkout"
              : "Fake checkout"}
      </h1>
      <dl className="mt-4 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-base">
        <dt className="text-slate">Item</dt>
        <dd>
          {subscription
            ? "Readyline registers subscription (monthly)"
            : "Readyline document pack"}
        </dd>
        <dt className="text-slate">Amount</dt>
        <dd data-testid="fake-amount">
          {formatAud(data.amountCents)}
          {subscription ? " a month" : ""}
        </dd>
        <dt className="text-slate">Session</dt>
        <dd className="text-sm break-all">{id.slice(0, 24)}…</dd>
      </dl>
      {receipt ? (
        <p className="mt-6 leading-7">
          Paid. In production this link opens the receipt Stripe emailed you.
        </p>
      ) : subscription ? (
        <div className="mt-8 flex flex-col gap-3">
          {portal ? null : (
            <form method="post" action={act}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="action" value="subscribe" />
              <button
                type="submit"
                className={button}
                data-testid="fake-subscribe"
              >
                Subscribe {formatAud(data.amountCents)} a month (fake)
              </button>
            </form>
          )}
          <a
            href={portal ? "/account" : data.cancelUrl}
            className={secondary}
            data-testid="fake-cancel"
          >
            {portal ? "Back to your account" : "Cancel and go back"}
          </a>
          <p className="text-slate mt-4 text-sm">
            Lifecycle events Stripe would send, for testing:
          </p>
          <form method="post" action={act}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="action" value="payment-failed" />
            <button
              type="submit"
              className={secondary}
              data-testid="fake-payment-failed"
            >
              Payment failed (fake, stays active)
            </button>
          </form>
          <form method="post" action={act}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="action" value="cancel-subscription" />
            <button
              type="submit"
              className={secondary}
              data-testid="fake-cancel-subscription"
            >
              Cancel the subscription (fake)
            </button>
          </form>
          <form method="post" action={act}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="action" value="renew" />
            <button
              type="submit"
              className={secondary}
              data-testid="fake-renew"
            >
              Renew (fake, active again)
            </button>
          </form>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-3">
          <form method="post" action={act}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="action" value="pay" />
            <button type="submit" className={button} data-testid="fake-pay">
              Pay {formatAud(data.amountCents)} (fake)
            </button>
          </form>
          <a
            href={data.cancelUrl}
            className={secondary}
            data-testid="fake-cancel"
          >
            Cancel and go back
          </a>
          <form method="post" action={act} className="mt-6">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="action" value="refund" />
            <button
              type="submit"
              className={secondary}
              data-testid="fake-refund"
            >
              Refund this payment (fake)
            </button>
          </form>
        </div>
      )}
    </PageShell>
  );
}
