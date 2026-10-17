import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BuyButton } from "@/app/documents/buy-button";
import { HOME_COPY } from "@/lib/home-copy";
import { formatAud, readPricing } from "@/lib/payments/pricing";
import { getViewer } from "@/server/accounts/queries";
import { loadPathContext } from "@/server/path/state";
import { createSupabaseServerClient } from "@/server/supabase/server";

export const metadata: Metadata = { title: "Before you buy" };

/**
 * Step 2 of the guided path (REQ-017, D-1703): one screen, three lines
 * (what you get, the price, the refund promise), one button, and the sample
 * for the cautious. A provider who has already paid is sent on to their
 * next step (FR-4).
 */
export default async function BeforeYouBuyPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=%2Fpath%2Fbefore-you-buy");
  if (viewer.deleted) redirect("/account/deleted");
  if (!viewer.account) redirect("/account/setup");
  const supabase = await createSupabaseServerClient();
  const ctx = await loadPathContext(supabase, {
    ...viewer,
    account: viewer.account,
  });
  if (!ctx.result) redirect("/start");
  if (ctx.state.paid) redirect("/documents");
  const pricing = readPricing();
  const documents = ctx.result.documents.length + 1;
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-semibold tracking-tight">
        Get your documents
      </h1>
      <p className="mt-4 text-lg leading-8" data-testid="buy-line-what">
        {documents} documents drafted for {viewer.account.trading_name}, as Word
        files you can edit.
      </p>
      <p className="mt-2 text-lg leading-8" data-testid="buy-line-price">
        {pricing.packPriceCents
          ? `${formatAud(pricing.packPriceCents)} once. No subscription, no instalments.`
          : "One fixed price, paid once. No subscription, no instalments."}
      </p>
      {/* Retro finding 113: at the point of sale the refund line carries its
          conditions (the pack paragraph the home page shows), not the open
          promise alone, which read as unconditional (ACL s 18). */}
      <p className="mt-2 text-lg leading-8" data-testid="buy-line-refund">
        {HOME_COPY.refundLine}
      </p>
      <BuyButton
        label="Get my documents"
        cancelPath="/path/before-you-buy"
        testId="path-buy-button"
      />
      <p className="mt-6 text-sm">
        <Link href="/sample" className="underline underline-offset-2">
          See a sample document first
        </Link>
      </p>
    </div>
  );
}
