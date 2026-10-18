import { PageShell } from "@/components/page-shell";
import type { Metadata } from "next";
import Link from "next/link";
import { businessIdentityLine } from "@/lib/legal/config";
import {
  formatUpdated,
  legalHeadingId,
  loadLegalPage,
} from "@/lib/legal/pages";
import { vendorTermsDate } from "@/lib/legal/vendor-terms";
import {
  TRUST_REVIEWED_LEAD,
  TRUST_ROWS,
  TRUST_SOURCE_LINK_LABEL,
  TRUST_TITLE,
} from "@/lib/trust/answers";

export const metadata: Metadata = {
  title: TRUST_TITLE,
  description:
    "Eight questions a provider asks before trusting a tool with their records, each answered in one line from the privacy policy, with the link to the sentence it comes from.",
};

/**
 * REQ-034 FR-1, FR-2, SR-1 (D-2944, D-2945): the trust page. Eight question
 * headings, each with its one-line answer and a link into the privacy
 * policy's section it restates; "Last reviewed" from the policy's own
 * `updated` date; the footer's business line. Static and public, nothing
 * read beyond the policy's front matter and the vendor-terms read date.
 */
export default function TrustPage() {
  const privacy = loadLegalPage("privacy");
  const vendorDate = formatUpdated(vendorTermsDate() ?? privacy.updated);
  const render = (text: string) =>
    text.replace(/\{\{vendor-terms-date\}\}/g, vendorDate);
  // The policy's numbered heading ids, looked up by the heading's words (FR-1).
  const hrefFor = (section: string) => {
    const id = legalHeadingId(privacy.markdown, section);
    return id ? `/privacy#${id}` : "/privacy";
  };
  return (
    <PageShell kind="reading">
      <h1 className="">{TRUST_TITLE}</h1>
      <p className="text-slate mt-2 text-sm" data-testid="trust-reviewed">
        {TRUST_REVIEWED_LEAD} {formatUpdated(privacy.updated)}
      </p>
      <div className="divide-rule mt-6 divide-y" data-testid="trust-rows">
        {TRUST_ROWS.map((r) => (
          <section
            key={r.id}
            className="py-5"
            aria-labelledby={`trust-${r.id}`}
            data-testid="trust-row"
            data-row={r.id}
          >
            <h2 id={`trust-${r.id}`} className="text-lg font-medium">
              {r.question}
            </h2>
            {r.list ? (
              <ul
                className="text-ink mt-2 list-disc space-y-1 pl-5 leading-7"
                data-testid="trust-answer"
              >
                {r.answer.map((s) => (
                  <li key={s}>{render(s)}</li>
                ))}
              </ul>
            ) : (
              <p className="text-ink mt-2 leading-7" data-testid="trust-answer">
                {render(r.answer.join(" "))}
              </p>
            )}
            <p className="mt-2 text-sm">
              <Link
                href={hrefFor(r.section)}
                className="inline-flex min-h-11 items-center underline underline-offset-4"
                data-testid="trust-source"
              >
                {TRUST_SOURCE_LINK_LABEL}
              </Link>
            </p>
          </section>
        ))}
      </div>
      <p className="text-slate mt-6 text-sm" data-testid="trust-identity">
        {businessIdentityLine()}
      </p>
    </PageShell>
  );
}
