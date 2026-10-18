import { PageShell } from "@/components/page-shell";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { contactEmail } from "@/lib/legal/config";
import { DocumentsNotices } from "./notices";
import { DOCUMENTS_COPY as C } from "@/lib/payments/documents-copy";
import {
  deriveDocumentsState,
  refundMailto,
  type DocumentsState,
  type PurchaseView,
} from "@/lib/payments/documents-state";
import { formatAud, readPricing } from "@/lib/payments/pricing";
import { getViewer } from "@/server/accounts/queries";
import {
  DISABLED_MESSAGE,
  isGenerationEnabled,
} from "@/server/generation/policy";
import { listVersionSets } from "@/server/generation/queries";
import {
  listEntitlements,
  listGenerationJobs,
  listPurchases,
} from "@/server/payments/queries";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { WritingIndicator } from "@/components/writing-indicator";
import type { WritingStatus } from "@/lib/generation/writing-state";
import { writingStatusFor } from "@/server/generation/writing-status";
import { listLatestDocuments } from "@/server/generation/queries";
import { documentTypeById } from "@/lib/generator/catalogue";
import { gapCountsLine } from "@/lib/gap-check/words";
import { resultDocuments } from "@/server/documents/result-types";
import {
  gapCheckDay,
  latestPerType,
  listGapChecks,
} from "@/server/gap-check/queries";
import { setZipSize } from "@/server/generation/zip-size";
import { zipSizeLine } from "@/lib/generator/zip-line";
import { AutoRefresh } from "./auto-refresh";
import { BuyButton } from "./buy-button";
import { GenerateButton } from "./generate-button";

export const metadata: Metadata = { title: "Your documents" };

const button =
  "inline-flex min-h-12 items-center justify-center rounded-md border border-line px-5 text-base font-medium hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2";
const link = "underline underline-offset-2";
const box = "mt-6 rounded-md border border-rule p-5";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    timeZone: "Australia/Sydney",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Receipt and refund links for a purchase (FR-6, FR-7). */
function PurchaseLinks({
  purchase,
  email,
}: {
  purchase: PurchaseView | null;
  email: string | null;
}) {
  if (!purchase) return null;
  return (
    <div className="text-ink mt-4 text-sm leading-6">
      <p>
        Paid {formatAud(purchase.amountCents)} on{" "}
        {formatDate(purchase.createdAt)}.{" "}
        {purchase.receiptUrl ? (
          <a
            href={purchase.receiptUrl}
            className={link}
            data-testid="receipt-link"
            rel="noopener noreferrer"
          >
            {C.receiptLink}
          </a>
        ) : (
          <span data-testid="receipt-pending">{C.receiptPending}</span>
        )}
      </p>
      {purchase.status === "paid" ? (
        <p className="mt-1">
          {email ? (
            <a
              href={refundMailto(email, purchase.id)}
              className={link}
              data-testid="refund-link"
            >
              {C.refundLink}
            </a>
          ) : (
            <span>
              {C.refundLink}: email us at the contact address in the footer and
              quote reference {purchase.id}.
            </span>
          )}{" "}
          {C.refundNote}{" "}
          <Link href="/refunds" className={link}>
            Refunds page
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}

function PurchaseSection({
  state,
  thanks,
  email,
  writing,
  zipLine,
}: {
  state: DocumentsState;
  thanks: boolean;
  email: string | null;
  /** REQ-021: the writing indicator's status for the active job, when there is one. */
  writing: WritingStatus | null;
  /** REQ-028 FR-7: the count and size line under the zip button of a ready set. */
  zipLine: string | null;
}) {
  const pricing = readPricing();
  switch (state.kind) {
    case "none":
      return (
        <section
          aria-labelledby="buy-heading"
          className={box}
          data-testid="purchase-none"
        >
          <h2 id="buy-heading" className="">
            {C.buyHeading}
          </h2>
          <p className="text-ink mt-2 leading-7">{C.buyLead}</p>
          {pricing.packPriceCents ? (
            <p className="mt-3">
              <span className="text-3xl font-semibold" data-testid="pack-price">
                {formatAud(pricing.packPriceCents)}
              </span>{" "}
              <span className="text-slate">one-off</span>
              {pricing.gstLine ? (
                <span className="text-slate block text-sm">
                  {pricing.gstLine}
                </span>
              ) : null}
            </p>
          ) : null}
          <BuyButton label={C.buyButton} cancelPath="/documents" />
          <p className="text-slate mt-3 text-sm leading-6">
            {C.buyTerms}{" "}
            <Link href="/pricing" className={link}>
              pricing page
            </Link>
            ,{" "}
            <Link href="/terms" className={link}>
              Terms of use
            </Link>{" "}
            and{" "}
            <Link href="/refunds" className={link}>
              Refunds page
            </Link>
            .
          </p>
        </section>
      );
    case "preparing":
      return (
        <section
          aria-label="Preparing your documents"
          className={box}
          data-testid="purchase-preparing"
        >
          <AutoRefresh lastChangeAt={state.job?.updatedAt ?? null} />
          {thanks ? (
            <p className="mb-3 leading-7" data-testid="purchase-thanks">
              {C.thanks}
            </p>
          ) : null}
          {writing ? (
            // REQ-021: the five honest phases from the job row; the words below stay for the status role.
            <WritingIndicator initial={writing} />
          ) : (
            <h2 className="">{C.preparingHeading}</h2>
          )}
          <p role="status" className="text-slate mt-3 text-sm leading-6">
            {C.preparing} {C.preparingProgress(state.documentsDone)}
          </p>
          <PurchaseLinks purchase={state.purchase} email={email} />
        </section>
      );
    case "delayed":
      return (
        <section
          aria-labelledby="delayed-heading"
          className={box}
          data-testid="purchase-delayed"
        >
          <h2 id="delayed-heading" className="">
            {C.preparingHeading}
          </h2>
          <p role="status" className="mt-2 leading-7">
            {C.delayed}
          </p>
          {/* REQ-028 FR-15 (audit 60): the one action this state can offer, and the support address. */}
          <p className="mt-3 text-sm leading-6">
            <Link
              href="/documents"
              className="underline underline-offset-2"
              data-testid="delayed-check-again"
            >
              Check again
            </Link>
            {email ? (
              <>
                {" "}
                or{" "}
                <a
                  href={`mailto:${email}`}
                  className="underline underline-offset-2"
                  data-testid="delayed-email"
                >
                  email us
                </a>
              </>
            ) : null}
            .
          </p>
          <PurchaseLinks purchase={state.purchase} email={email} />
        </section>
      );
    case "ready":
      return (
        <section
          aria-labelledby="ready-heading"
          className={box}
          data-testid="purchase-ready"
        >
          {writing && writing.phase === "ready" ? (
            // REQ-021 S6, AC-3: the Ready state at once, leading with the next step of the guided path.
            <WritingIndicator initial={writing} />
          ) : (
            <h2 id="ready-heading" className="">
              {C.readyHeading}
            </h2>
          )}
          <p className="mt-2 leading-7">{C.readyLead}</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <a
              href={`/documents/${state.versionSetId}/download?file=set.zip`}
              className="btn-primary"
              data-testid="download-zip"
            >
              Download all as one file (zip)
            </a>
            <a
              href={`/documents/${state.versionSetId}/download?file=readiness-summary.pdf`}
              className={button}
              data-testid="download-pdf"
            >
              Readiness summary (PDF)
            </a>
            <Link
              href={`/documents/${state.versionSetId}`}
              className={button}
              data-testid="open-set"
            >
              {C.openSet}
            </Link>
          </div>
          {zipLine ? (
            <p className="text-slate mt-2 text-sm" data-testid="zip-size-line">
              {zipLine}
            </p>
          ) : null}
          <PurchaseLinks purchase={state.purchase} email={email} />
        </section>
      );
    case "refunded":
      return (
        <section
          aria-labelledby="refunded-heading"
          className={box}
          data-testid="purchase-refunded"
        >
          <h2 id="refunded-heading" className="">
            {C.refundedHeading}
          </h2>
          <p className="mt-2 leading-7">
            {C.refunded} Refunded on{" "}
            {formatDate(state.purchase.refundedAt ?? state.purchase.createdAt)}.
          </p>
          <BuyButton
            label={C.buyButton}
            cancelPath="/documents"
            testId="buy-again-button"
          />
        </section>
      );
  }
}

export default async function DocumentsPage({
  searchParams,
}: PageProps<"/documents">) {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=%2Fdocuments");
  if (viewer.deleted) redirect("/account/deleted");
  if (!viewer.account) redirect("/account/setup");
  const sp = await searchParams;
  const thanks = sp.purchase === "success";
  const enabled = isGenerationEnabled();
  const supabase = await createSupabaseServerClient();
  const accountId = viewer.account.id;
  const [purchases, entitlements, jobs, sets, gapChecks, resultDocs] =
    await Promise.all([
      listPurchases(supabase, accountId),
      listEntitlements(supabase, accountId),
      listGenerationJobs(supabase, accountId),
      listVersionSets(supabase, accountId),
      // REQ-035 FR-5: the owner's gap checks, newest first.
      listGapChecks(supabase, accountId),
      // REQ-035 D-2966 (question 2 (a)): the result's documents, for the catalogue list before a set exists.
      resultDocuments(),
    ]);
  const latestGapChecks = latestPerType(gapChecks);
  const state = deriveDocumentsState({ purchases, entitlements, jobs });
  // REQ-021: the writing indicator's status while a pack is being written and once it is ready.
  const writing =
    state.kind === "preparing" || state.kind === "ready"
      ? await writingStatusFor(
          supabase,
          viewer as typeof viewer & {
            account: NonNullable<typeof viewer.account>;
          },
        )
      : null;
  const email = contactEmail();
  // REQ-028 FR-7: the count and size line under a ready set's zip button (D-2275 (4)).
  const zipLine =
    state.kind === "ready"
      ? zipSizeLine(
          (await listLatestDocuments(supabase, state.versionSetId)).length,
          await setZipSize(accountId, state.versionSetId),
        )
      : null;
  // The paid set is shown above; the list below is for regenerated or dev sets.
  const otherSets = sets.filter(
    (s) => !(state.kind === "ready" && s.id === state.versionSetId),
  );

  return (
    <PageShell kind="grid">
      <h1 className="">Your documents</h1>
      <p className="text-ink mt-3 leading-7">{C.intro}</p>

      {/* Batch 45 item 2: with generation off and nothing bought, no Buy box; the one line below says why. */}
      {enabled || state.kind !== "none" ? (
        <PurchaseSection
          state={state}
          thanks={thanks}
          zipLine={zipLine}
          email={email}
          writing={writing}
        />
      ) : null}
      {state.kind === "ready" || state.kind === "preparing" ? (
        <DocumentsNotices />
      ) : null}

      {enabled ? (
        <section aria-labelledby="generate-heading" className="mt-10">
          <h2 id="generate-heading" className="">
            Generate a new set
          </h2>
          <p className="text-ink mt-2 text-sm leading-6">
            Uses your current questionnaire answers. Each account can generate a
            few sets a day; the limit resets at midnight Sydney time.
          </p>
          <GenerateButton />
        </section>
      ) : state.kind === "none" ? (
        <p
          role="status"
          data-testid="generation-disabled"
          className="text-slate mt-6 text-sm leading-6"
        >
          {DISABLED_MESSAGE}{" "}
          <Link href="/start/result" className={link}>
            See your result
          </Link>
          .
        </p>
      ) : null}

      {/* REQ-035 D-2966 (question 2 (a)): before a set exists, the documents the answers call for, one anchor each, so a gap check's "In the Readyline pack" link lands on its entry. */}
      {state.kind !== "ready" && resultDocs && resultDocs.length > 0 ? (
        <section
          aria-labelledby="pack-holds-heading"
          className="mt-10"
          data-testid="pack-holds"
        >
          <h2 id="pack-holds-heading" className="">
            {C.packHoldsHeading}
          </h2>
          <p className="text-ink mt-2 text-sm leading-6">{C.packHoldsLead}</p>
          <ol className="text-ink mt-3 list-decimal space-y-1 pl-6 leading-7">
            {resultDocs.map((d) => (
              <li
                key={d.id}
                id={d.id}
                className="scroll-mt-24"
                data-testid="pack-holds-item"
              >
                {d.title}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/* REQ-035 FR-5 (D-2966): the owner's own policies checked against the outline, the newest per type. */}
      <section
        aria-labelledby="gap-heading"
        className="mt-10"
        data-testid="documents-gap-checks"
      >
        <h2 id="gap-heading" className="">
          {C.gapHeading}
        </h2>
        <p className="text-ink mt-2 text-sm leading-6">{C.gapLead}</p>
        {latestGapChecks.length === 0 ? (
          <p
            className="text-slate mt-2 text-sm"
            data-testid="documents-gap-none"
          >
            {C.gapNone}
          </p>
        ) : (
          <ul className="divide-rule mt-3 divide-y">
            {latestGapChecks.map((c) => (
              <li key={c.id} className="py-3" data-testid="documents-gap-item">
                <Link
                  href={`/documents/gap-check/${c.id}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {gapCountsLine(
                    c.title,
                    documentTypeById(c.document_type_id)?.title ??
                      c.document_type_id,
                    c,
                  )}
                </Link>
                <p className="text-slate text-sm">
                  {gapCheckDay(c.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3">
          <Link
            href="/documents/gap-check"
            className="btn-secondary text-sm"
            data-testid="documents-gap-link"
          >
            {C.gapLink}
          </Link>
        </p>
      </section>

      {otherSets.length > 0 ? (
        <section aria-labelledby="sets-heading" className="mt-10">
          <h2 id="sets-heading" className="">
            {state.kind === "ready" ? "Other document sets" : "Document sets"}
          </h2>
          <ul className="divide-rule mt-3 divide-y">
            {otherSets.map((s) => (
              <li key={s.id} className="py-3">
                <Link
                  href={`/documents/${s.id}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  Set generated{" "}
                  {new Date(s.created_at).toLocaleString("en-AU", {
                    timeZone: "Australia/Sydney",
                  })}
                </Link>
                <p className="text-slate text-sm">
                  {s.status === "ready"
                    ? `${s.document_count} documents; ${s.fallback_section_count} section${s.fallback_section_count === 1 ? "" : "s"} to review`
                    : s.status === "generating"
                      ? "Generating…"
                      : "Not available"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </PageShell>
  );
}
