import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { PRICING_COPY as C } from "@/lib/payments/copy";
import { formatAud, readPricing } from "@/lib/payments/pricing";
import { refundPromise } from "@/lib/payments/refund-promise";
import {
  documentSetsContent,
  documentTitle,
} from "@/lib/questionnaire/content";
import { ANSWERS_VERSION, answersSchemaFor } from "@/lib/questionnaire/schema";
import { buildResult } from "@/lib/questionnaire/result";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { loadServerDraft } from "@/server/accounts/actions";
import { getViewer } from "@/server/accounts/queries";

export const metadata: Metadata = { title: "Pricing" };

/**
 * The pricing page (REQ-007 FR-1): one fixed price, what the pack is and is
 * not, the refund promise from refunds.md, the AI disclosure, the subscription
 * shown as coming, and the links the law and the house rules require. Works
 * signed out; a signed-in owner with a complete questionnaire sees their own
 * document set instead of the core set. Session C replaces the sign-in link
 * with the Buy action.
 */
async function documentsForVisitor(): Promise<{
  titles: string[];
  tailored: boolean;
}> {
  const core = documentSetsContent.always.map((id) => documentTitle(id));
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted)
    return { titles: core, tailored: false };
  const draft = await loadServerDraft();
  if (!draft) return { titles: core, tailored: false };
  const dataset = getStandardsDataset();
  const schema = answersSchemaFor(
    new Set(dataset.registrationGroups.map((g) => g.code)),
  );
  const parsed = schema.safeParse({
    answersVersion: ANSWERS_VERSION,
    ...draft.answers,
  });
  if (!parsed.success) return { titles: core, tailored: false };
  const built = buildResult(dataset, parsed.data);
  if (!built.ok) return { titles: core, tailored: false };
  return {
    titles: [
      ...built.result.documents.map((d) => d.title),
      "Practice Standards self-assessment",
    ],
    tailored: true,
  };
}

const h2 = "mt-10 text-xl font-semibold";
const body = "mt-3 leading-7 text-zinc-700 dark:text-zinc-300";
const link = "underline underline-offset-2";

export default async function PricingPage() {
  const pricing = readPricing();
  const promise = refundPromise();
  const docs = await documentsForVisitor();
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-semibold tracking-tight">{C.title}</h1>
      <p className={body}>{C.intro}</p>

      <section
        aria-labelledby="price-heading"
        className="mt-8 rounded-md border border-zinc-300 p-5 dark:border-zinc-700"
      >
        <h2 id="price-heading" className="text-xl font-semibold">
          {C.priceHeading}
        </h2>
        {pricing.packPriceCents ? (
          <p className="mt-2">
            <span className="text-3xl font-semibold" data-testid="pack-price">
              {formatAud(pricing.packPriceCents)}
            </span>
            <span className="ml-2 text-zinc-600 dark:text-zinc-400">
              one-off, for the document pack
            </span>
          </p>
        ) : (
          <p className={body} data-testid="pack-price-unset">
            {C.priceUnset}
          </p>
        )}
        {pricing.gstLine ? (
          <p
            className="mt-2 text-sm text-zinc-600 dark:text-zinc-400"
            data-testid="gst-line"
          >
            {pricing.gstLine}
          </p>
        ) : null}
        <p className="mt-4">
          <Link
            href="/sign-in?next=%2Fpricing"
            className="inline-flex min-h-12 items-center justify-center rounded-md bg-zinc-900 px-5 text-base font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            data-testid="sign-in-to-buy"
          >
            {C.signInToBuy}
          </Link>
        </p>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {C.signInNote}
        </p>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {C.termsLead}{" "}
          <Link href="/terms" className={link}>
            {C.terms}
          </Link>
          ,{" "}
          <Link href="/privacy" className={link}>
            {C.privacy}
          </Link>{" "}
          and{" "}
          <Link href="/refunds" className={link}>
            {C.refundsPage}
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="get-heading">
        <h2 id="get-heading" className={h2}>
          {C.whatYouGetHeading}
        </h2>
        <p className={body}>
          {docs.tailored ? C.whatYouGetForYou : C.whatYouGetCore}
        </p>
        <ul
          className="mt-3 list-disc space-y-1 pl-5 leading-7 text-zinc-700 dark:text-zinc-300"
          data-testid="pack-documents"
        >
          {docs.titles.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="not-heading">
        <h2 id="not-heading" className={h2}>
          {C.whatItIsNotHeading}
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 leading-7 text-zinc-700 dark:text-zinc-300">
          {C.whatItIsNot.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="refund-heading">
        <h2 id="refund-heading" className={h2}>
          {C.refundHeading}
        </h2>
        <div data-testid="refund-promise">
          {promise.map((p) => (
            <p key={p} className={body}>
              {p}
            </p>
          ))}
        </div>
      </section>

      <section aria-labelledby="ai-heading">
        <h2 id="ai-heading" className={h2}>
          {C.aiHeading}
        </h2>
        <p className={body} data-testid="pricing-ai-disclosure">
          {C.aiDisclosure}
        </p>
        <p className={body} data-testid="pricing-notice">
          {C.notLegalAdvice}
        </p>
      </section>

      <section aria-labelledby="sub-heading">
        <h2 id="sub-heading" className={h2}>
          {C.subscriptionHeading}
        </h2>
        <p className={body} data-testid="subscription-coming">
          {C.subscriptionComing}
          {pricing.subscriptionPriceCents
            ? ` ${C.subscriptionPriceLead} ${formatAud(pricing.subscriptionPriceCents)} a month.`
            : ""}
        </p>
      </section>

      <p className="mt-10 text-sm text-zinc-600 dark:text-zinc-400">
        Questions before you buy? Email {BRAND} at the contact address in the
        footer.
      </p>
    </div>
  );
}
