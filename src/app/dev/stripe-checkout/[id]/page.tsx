import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { decodeFakeSession } from "@/lib/payments/fake-session";
import { formatAud } from "@/lib/payments/pricing";
import { readStripeEnv, StripeEnvError } from "@/server/payments/stripe";
import { fakeCheckoutAction } from "../actions";

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
  const button =
    "inline-flex min-h-12 items-center justify-center rounded-md bg-zinc-900 px-5 text-base font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";
  const secondary =
    "inline-flex min-h-12 items-center justify-center rounded-md border border-zinc-300 px-5 text-base font-medium hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-zinc-700 dark:hover:bg-zinc-900";

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10 sm:px-6 sm:py-14">
      <p className="rounded-md border border-amber-700 bg-amber-50 p-3 text-sm leading-6 text-amber-900 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-200">
        Test environment only. This page stands in for Stripe Checkout; no
        payment is taken and no card details are asked for.
      </p>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">
        {receipt ? "Fake receipt" : "Fake checkout"}
      </h1>
      <dl className="mt-4 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-base">
        <dt className="text-zinc-600 dark:text-zinc-400">Item</dt>
        <dd>Readyline document pack</dd>
        <dt className="text-zinc-600 dark:text-zinc-400">Amount</dt>
        <dd data-testid="fake-amount">{formatAud(data.amountCents)}</dd>
        <dt className="text-zinc-600 dark:text-zinc-400">Session</dt>
        <dd className="text-sm break-all">{id.slice(0, 24)}…</dd>
      </dl>
      {receipt ? (
        <p className="mt-6 leading-7">
          Paid. In production this link opens the receipt Stripe emailed you.
        </p>
      ) : (
        <div className="mt-8 flex flex-col gap-3">
          <form action={fakeCheckoutAction}>
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
          <form action={fakeCheckoutAction} className="mt-6">
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
    </div>
  );
}
