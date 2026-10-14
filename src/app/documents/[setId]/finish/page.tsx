import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { collectBlanks } from "@/lib/generator/blanks";
import { questionsFor } from "@/lib/generator/facts-fill";
import { orderDocuments } from "@/lib/generator/set-order";
import { getViewer } from "@/server/accounts/queries";
import {
  getVersionSet,
  listLatestDocuments,
} from "@/server/generation/queries";
import { loadFacts } from "@/server/path/facts";
import { isSetLocked } from "@/server/payments/queries";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { FinishForm } from "./finish-form";

export const metadata: Metadata = { title: "Finish your pack" };

/**
 * Step 4 of the guided path (REQ-017 FR-2, D-1702): every blank the
 * documents still carry becomes one question, asked once per fact across
 * the set; the answers are saved as account facts and the documents are
 * re-rendered on the last screen. When nothing is left, the page says so
 * and points to the next step.
 */
export default async function FinishPackPage({
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
  const questions = questionsFor(blanks);
  const facts = await loadFacts(supabase, viewer.account.id);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-sm">
        <Link
          href={`/documents/${set.id}`}
          className="underline underline-offset-2"
        >
          Back to the set
        </Link>
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Finish your pack
      </h1>
      {questions.length === 0 ? (
        <p className="mt-3 leading-7" data-testid="finish-summary">
          Every blank is filled in. Your {documents.length} documents are
          complete.{" "}
          <Link href="/path/adopt" className="underline underline-offset-2">
            Adopt them next
          </Link>
          .
        </p>
      ) : (
        <>
          <p className="mt-3 leading-7" data-testid="finish-summary">
            {questions.length === 1
              ? "One question, then your documents are complete."
              : `${questions.length} questions, then your documents are complete.`}{" "}
            We fill in every document for you.
          </p>
          <FinishForm
            setId={set.id}
            questions={questions}
            initial={facts}
            documentCount={documents.length}
          />
        </>
      )}
    </div>
  );
}
