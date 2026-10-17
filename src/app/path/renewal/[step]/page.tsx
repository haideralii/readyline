import { PageShell } from "@/components/page-shell";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  RENEWAL_FORMS,
  applicationWindowLine,
  isRenewalDatedStep,
} from "@/lib/path/renewal";
import { getViewer } from "@/server/accounts/queries";
import { currentPeriod } from "@/server/registers/registration-queries";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { RenewalStepForm } from "../renewal-step-form";

export const metadata: Metadata = { title: "Your renewal path" };

/**
 * One dated step of the renewal path (REQ-023 FR-7): the application, the
 * scope of audit, the booking or the decision, one date and one button, with
 * the Commission's practice lines where the REQ gives them (findings 88 and
 * 89). An unknown step is 404; without a period the path asks for the dates.
 */
export default async function RenewalStepPage({
  params,
}: PageProps<"/path/renewal/[step]">) {
  const { step } = await params;
  if (!isRenewalDatedStep(step)) notFound();
  const viewer = await getViewer();
  if (!viewer)
    redirect(`/sign-in?next=${encodeURIComponent(`/path/renewal/${step}`)}`);
  if (viewer.deleted) redirect("/account/deleted");
  if (!viewer.account) redirect(viewer.worker ? "/worker" : "/account/setup");
  const supabase = await createSupabaseServerClient();
  const period = await currentPeriod(supabase, viewer.account.id);
  if (!period) redirect("/path/renewal");
  const form = RENEWAL_FORMS[step];
  const current = (period as Record<string, unknown>)[form.column] as
    string | null | undefined;
  const windowLine =
    step === "application" ? applicationWindowLine(period) : null;
  return (
    <PageShell kind="form">
      <p className="text-sm">
        <Link
          href="/path/renewal"
          className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
        >
          ‹ Your renewal path
        </Link>
      </p>
      <h1 className="mt-2">{form.title}</h1>
      {form.lines.map((line) => (
        <p key={line} className="text-ink mt-3 text-sm leading-6">
          {line}
        </p>
      ))}
      {windowLine ? (
        <p
          className="text-ink mt-3 text-sm leading-6"
          data-testid="renewal-window-line"
        >
          {windowLine}
        </p>
      ) : null}
      <RenewalStepForm
        step={step}
        dateLabel={form.dateLabel}
        initialDate={current ?? ""}
        initialAuditor={period.auditor_business_name ?? ""}
      />
    </PageShell>
  );
}
