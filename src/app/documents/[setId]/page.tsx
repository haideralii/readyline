import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DOCUMENTS_COPY } from "@/lib/payments/documents-copy";
import { getViewer } from "@/server/accounts/queries";
import {
  getVersionSet,
  listLatestDocuments,
} from "@/server/generation/queries";
import { isSetLocked } from "@/server/payments/queries";
import { createSupabaseServerClient } from "@/server/supabase/server";

export const metadata: Metadata = { title: "Document set" };

const button =
  "inline-flex min-h-12 items-center justify-center rounded-md border border-zinc-300 px-5 text-base font-medium hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-zinc-700 dark:hover:bg-zinc-900";

export default async function DocumentSetPage({
  params,
}: PageProps<"/documents/[setId]">) {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=%2Fdocuments");
  if (!viewer.account) redirect("/account/setup");
  const { setId } = await params;
  const supabase = await createSupabaseServerClient();
  const set = await getVersionSet(supabase, setId);
  if (!set || set.account_id !== viewer.account.id) notFound();
  // FR-8: a refunded pack keeps its data but serves nothing.
  if (await isSetLocked(supabase, set.id)) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-sm">
          <Link href="/documents" className="underline underline-offset-2">
            All document sets
          </Link>
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Document set
        </h1>
        <p
          role="status"
          className="mt-3 leading-7 text-zinc-700 dark:text-zinc-300"
          data-testid="set-locked"
        >
          {DOCUMENTS_COPY.lockedSet}
        </p>
      </div>
    );
  }
  const documents = await listLatestDocuments(supabase, set.id);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-sm">
        <Link href="/documents" className="underline underline-offset-2">
          All document sets
        </Link>
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Document set
      </h1>
      <p className="mt-3 leading-7 text-zinc-700 dark:text-zinc-300">
        Generated{" "}
        {new Date(set.created_at).toLocaleString("en-AU", {
          timeZone: "Australia/Sydney",
        })}
        . {set.document_count} documents; {set.fallback_section_count} section
        {set.fallback_section_count === 1 ? "" : "s"} marked for your review.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <a
          href={`/documents/${set.id}/download?file=set.zip`}
          className={button}
          data-testid="download-zip"
        >
          Download all (zip)
        </a>
        <a
          href={`/documents/${set.id}/download?file=readiness-summary.pdf`}
          className={button}
          data-testid="download-pdf"
        >
          Readiness summary (PDF)
        </a>
      </div>

      <section aria-labelledby="docs-heading" className="mt-10">
        <h2 id="docs-heading" className="text-xl font-semibold">
          Documents
        </h2>
        <ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
          {documents.map((d) => (
            <li
              key={d.id}
              className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <Link
                href={`/documents/${set.id}/${d.document_type_id}`}
                className="underline-offset-4 hover:underline"
              >
                {d.model.title}
              </Link>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {d.status === "ready" ? "Drafted" : "Review needed"} · version{" "}
                {d.version}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
