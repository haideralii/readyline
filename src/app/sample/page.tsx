import { PageShell } from "@/components/page-shell";
import type { Metadata } from "next";
import Link from "next/link";
import { SampleDocument } from "@/components/sample-document";
import { StartHereSheetView } from "@/components/start-here-sheet";
import { sheetLines } from "@/lib/generator/start-here";
import { HOME_COPY as C } from "@/lib/home-copy";
import { SAMPLE_START_HERE } from "@/lib/sample-start-here";
import { Disclosure } from "@/components/disclosure";
import {
  packCountLine,
  SAMPLE_PACK_HEADING,
  SAMPLE_PACK_LEAD,
  samplePackLists,
} from "@/lib/sample-pack-lists";

export const metadata: Metadata = {
  title: "Sample document",
  description:
    "A real complaints policy from a recorded run for a fictional sole trader: the sections drafted from the answers marked, the fixed text shown as what it is, and a Word download.",
};

/**
 * The sample document's own page (REQ-025 FR-12): the full sample with its
 * download button, moved off the home page so that page fits a phone. The
 * home page keeps a card and two links; the hero's "See a sample document"
 * lands here. Under the document, the Start here sheet the sole-trader
 * reference case gets with its documents (REQ-031 FR-3; D-2888, D-2896),
 * read-only, so a provider sees the list before paying.
 */
export default function SamplePage() {
  // REQ-034 FR-5 (D-2951): the two cases' document lists, from the results themselves.
  const packs = samplePackLists();
  const packWords = [
    SAMPLE_PACK_HEADING,
    SAMPLE_PACK_LEAD,
    ...packs.flatMap((p) => [p.label, packCountLine(p.count), ...p.titles]),
  ];
  return (
    <PageShell kind="reading">
      <p className="text-sm">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
        >
          ‹ Home
        </Link>
      </p>
      <h1 className="mt-2">{C.sampleHeading}</h1>
      <p className="text-ink mt-3 leading-7">{C.samplePageLead}</p>
      <div className="mt-6">
        <SampleDocument
          level={2}
          moreText={[
            C.sampleSheetLine,
            ...sheetLines(SAMPLE_START_HERE),
            ...packWords,
          ].join("\n")}
        />
      </div>
      <div className="mt-10" data-testid="sample-start-here">
        <p className="text-slate text-sm" data-testid="sample-start-here-line">
          {C.sampleSheetLine}
        </p>
        <StartHereSheetView sheet={SAMPLE_START_HERE} setId={null} level={2} />
      </div>
      {/* REQ-034 FR-5 (D-2951): what a pack holds, for the two cases buyers weigh first; the glossary line above covers the audit words (D-2852). */}
      <section
        className="mt-10"
        aria-labelledby="sample-pack-heading"
        data-testid="sample-pack-lists"
      >
        <h2 id="sample-pack-heading" className="">
          {SAMPLE_PACK_HEADING}
        </h2>
        <p className="text-slate mt-2 text-sm leading-6">{SAMPLE_PACK_LEAD}</p>
        <div className="mt-3">
          {packs.map((p) => (
            <Disclosure
              key={p.id}
              summary={`${p.label}: ${packCountLine(p.count)}`}
              summaryTestId={`sample-pack-summary-${p.id}`}
              data-testid="sample-pack-list"
              data-case={p.id}
            >
              <ol className="text-ink mt-2 list-decimal space-y-1 pl-6 leading-7">
                {p.titles.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ol>
            </Disclosure>
          ))}
        </div>
      </section>
      <p className="mt-8">
        <Link href="/start" className="btn-primary" data-testid="sample-cta">
          See which audit I need
        </Link>
      </p>
    </PageShell>
  );
}
