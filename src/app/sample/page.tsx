import { PageShell } from "@/components/page-shell";
import type { Metadata } from "next";
import Link from "next/link";
import { SampleDocument } from "@/components/sample-document";
import { HOME_COPY as C } from "@/lib/home-copy";

export const metadata: Metadata = {
  title: "Sample document",
  description:
    "A real complaints policy from a recorded run for a fictional sole trader: the sections drafted from the answers marked, the fixed text shown as what it is, and a Word download.",
};

/**
 * The sample document's own page (REQ-025 FR-12): the full sample with its
 * download button, moved off the home page so that page fits a phone. The
 * home page keeps a card and two links; the hero's "See a sample document"
 * lands here.
 */
export default function SamplePage() {
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
        <SampleDocument level={2} />
      </div>
      <p className="mt-8">
        <Link href="/start" className="btn-primary" data-testid="sample-cta">
          See which audit I need
        </Link>
      </p>
    </PageShell>
  );
}
