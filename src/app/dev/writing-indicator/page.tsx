import { PageShell } from "@/components/page-shell";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WritingIndicator } from "@/components/writing-indicator";
import {
  DEMO_SCENARIOS,
  demoClock,
  demoDocuments,
  demoStatus,
  type DemoScenario,
} from "@/lib/generation/writing-demo";
import { readStripeEnv, StripeEnvError } from "@/server/payments/stripe";

export const metadata: Metadata = { title: "Writing indicator (test only)" };

/**
 * The writing indicator on a scripted feed (REQ-021 S1 to S12 in the
 * Playwright suite; fake mode only, 404 everywhere else). `?scenario=`
 * picks the script and `?t0=` fixes its start, so a test sees the same
 * phases at the same seconds.
 */
export default async function WritingIndicatorDemoPage({
  searchParams,
}: PageProps<"/dev/writing-indicator">) {
  let env;
  try {
    env = readStripeEnv();
  } catch (e) {
    if (e instanceof StripeEnvError) notFound();
    throw e;
  }
  if (!env.fake) notFound();
  const sp = await searchParams;
  const scenario = (DEMO_SCENARIOS as readonly string[]).includes(
    String(sp.scenario),
  )
    ? (String(sp.scenario) as DemoScenario)
    : "happy";
  const now = demoClock();
  const t0 = Number(sp.t0) > 0 ? Number(sp.t0) : now;
  const initial = demoStatus({
    scenario: scenario === "offline" ? "quiet" : scenario,
    documents: demoDocuments(),
    t0,
    now,
  });
  return (
    <PageShell kind="reading">
      <p className="rounded-md border border-amber-700 bg-amber-50 p-3 text-sm leading-6 text-amber-900 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-200">
        Test environment only. This page shows the writing indicator on a
        scripted feed; nothing here is a real document.
      </p>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">
        Your documents
      </h1>
      <section className="border-rule mt-6 rounded-md border p-5">
        <WritingIndicator
          initial={initial}
          pollUrl={`/api/dev/writing-status?scenario=${scenario}&t0=${t0}`}
          pollMs={1000}
          downloadHrefTemplate="/documents"
        />
      </section>
    </PageShell>
  );
}
