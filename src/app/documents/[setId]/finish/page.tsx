import { PageShell } from "@/components/page-shell";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { collectBlanks } from "@/lib/generator/blanks";
import {
  detailsQuestionsFor,
  factKeyFor,
  openFormBlanks,
} from "@/lib/generator/facts-fill";
import { STATE_NAMES, formatAbn } from "@/lib/generator/facts";
import { orderDocuments } from "@/lib/generator/set-order";
import {
  DETAILS_ADOPT_NEXT,
  DETAILS_ALL_FILLED,
  DETAILS_APPROVER_LINE,
  DETAILS_BACK,
  DETAILS_COMPLETE,
  DETAILS_INTRO,
  DETAILS_NOTHING_ELSE,
  DETAILS_TITLE,
} from "@/lib/path/details-copy";
import { getViewer } from "@/server/accounts/queries";
import {
  getVersionSet,
  listLatestDocuments,
} from "@/server/generation/queries";
import { loadFacts } from "@/server/path/facts";
import { isSetLocked } from "@/server/payments/queries";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { FinishForm } from "./finish-form";

export const metadata: Metadata = { title: DETAILS_TITLE };

/**
 * "Your details" (REQ-029 FR-1; D-2854, D-2855): one page that asks for
 * every fact key the set's blanks use, once each, in FR-1's order, saved as
 * each field loses focus and filled into every document at download. The
 * approver's name and role are asked here and on the account page (one pair
 * of rows); the approval date is never a field. The page stays reachable
 * after everything is filled, so a changed phone number is typed here.
 */
export default async function YourDetailsPage({
  params,
}: PageProps<"/documents/[setId]/finish">) {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=%2Fdocuments");
  if (!viewer.account) redirect("/account/setup");
  const { setId } = await params;
  const supabase = await createSupabaseServerClient();
  const set = await getVersionSet(supabase, setId);
  if (!set || set.account_id !== viewer.account.id) notFound();
  if (await isSetLocked(supabase, set.id)) redirect(`/documents/${set.id}`);
  const documents = orderDocuments(
    await listLatestDocuments(supabase, set.id),
  ).flatMap((g) => g.documents);
  const blanks = documents.flatMap((d) => collectBlanks(d.model));
  const questions = detailsQuestionsFor(blanks);
  const [facts, account] = await Promise.all([
    loadFacts(supabase, viewer.account.id),
    supabase
      .from("accounts")
      .select("trading_name, abn, states")
      .eq("id", viewer.account.id)
      .maybeSingle(),
  ]);
  const open = openFormBlanks(blanks, facts).length;
  const dateBlank = blanks.some((b) => factKeyFor(b.blank) === "date");
  const a = (account.data ?? null) as {
    trading_name: string;
    abn: string | null;
    states: string[] | null;
  } | null;
  const states = a?.states ?? [];
  const stateName =
    states.length === 1 ? (STATE_NAMES[states[0]] ?? states[0]) : null;

  return (
    <PageShell kind="form">
      <p className="text-sm">
        <Link
          href={`/documents/${set.id}`}
          className="underline underline-offset-2"
        >
          {DETAILS_BACK}
        </Link>
      </p>
      <h1 className="mt-2">{DETAILS_TITLE}</h1>
      <p className="mt-3 leading-7" data-testid="finish-summary">
        {open === 0 ? (
          <>
            {dateBlank ? DETAILS_NOTHING_ELSE : DETAILS_ALL_FILLED}{" "}
            {DETAILS_COMPLETE(documents.length)}{" "}
            <Link href="/path/adopt" className="underline underline-offset-2">
              {DETAILS_ADOPT_NEXT}
            </Link>
            .
          </>
        ) : (
          DETAILS_INTRO
        )}
      </p>
      <p
        className="text-slate mt-2 text-sm leading-6"
        data-testid="finish-date"
      >
        {DETAILS_APPROVER_LINE}
      </p>
      <FinishForm
        setId={set.id}
        questions={questions}
        initial={facts}
        documentCount={documents.length}
        prefill={stateName ? { state: stateName } : {}}
        business={{
          name: a?.trading_name ?? viewer.account.trading_name,
          abn: formatAbn(a?.abn),
        }}
      />
    </PageShell>
  );
}
