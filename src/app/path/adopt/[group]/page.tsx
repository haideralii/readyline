import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { GlossaryBracket } from "@/components/glossary-terms";
import { documentTypeById } from "@/lib/generator/catalogue";
import { groupSlug, orderDocuments } from "@/lib/generator/set-order";
import {
  ADOPT_NEEDS_NAME,
  ADOPT_NEEDS_NAME_HREF,
  ADOPT_NEEDS_NAME_LINK,
} from "@/lib/path/adopt-copy";
import { getViewer } from "@/server/accounts/queries";
import { loadFacts } from "@/server/path/facts";
import { loadPathContext } from "@/server/path/state";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { AdoptButton } from "../adopt-button";

export const metadata: Metadata = { title: "Adopt your documents" };

/**
 * Step 5, one screen per document group (REQ-017 FR-3, FR-5, D-1703): the
 * document names with a two-line summary each, one button, and the names
 * as links for a provider who wants to read first. Printable: the print
 * sheet keeps the list and drops the controls.
 */
export default async function AdoptGroupPage({
  params,
}: PageProps<"/path/adopt/[group]">) {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=%2Fpath%2Fadopt");
  if (viewer.deleted) redirect("/account/deleted");
  if (!viewer.account) redirect("/account/setup");
  const { group: slug } = await params;
  const supabase = await createSupabaseServerClient();
  const ctx = await loadPathContext(supabase, {
    ...viewer,
    account: viewer.account,
  });
  const setId = ctx.state.readySetId;
  if (!setId) redirect("/documents");
  const groups = orderDocuments(ctx.documents);
  const index = groups.findIndex((g) => groupSlug(g.title) === slug);
  if (index === -1) notFound();
  const group = groups[index];
  const adopted = group.documents.every((d) =>
    ctx.adopted.has(d.document_type_id),
  );
  const next = groups[index + 1];
  const nextHref = next ? `/path/adopt/${groupSlug(next.title)}` : "/checklist";
  const previous = groups[index - 1];
  // Retro finding 114 (D-2244): adoption names a person, so the screen asks
  // for the name before it offers the button; the action refuses as well.
  const facts = adopted ? null : await loadFacts(supabase, viewer.account.id);
  const needsName = facts !== null && !facts.name?.trim();
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Adopt your documents: group {index + 1} of {groups.length}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        {group.title}
      </h1>
      <p className="mt-3 leading-7">
        Read the names below. Tap a name to read the document. When they say
        what you do, press the button and they become your policies. That is
        what it means to <GlossaryBracket id="adopt" />.
      </p>
      <ul
        className="mt-6 divide-y divide-zinc-200 dark:divide-zinc-800"
        data-testid="adopt-list"
      >
        {group.documents.map((d) => {
          const type = documentTypeById(d.document_type_id);
          return (
            <li key={d.id} className="py-3">
              <Link
                href={`/documents/${setId}/${d.document_type_id}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                {d.model.title}
              </Link>
              <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                {type?.purpose ?? ""}
              </p>
            </li>
          );
        })}
      </ul>
      {adopted ? (
        <p role="status" className="mt-6 leading-7" data-testid="adopt-done">
          Adopted. These are your policies now.{" "}
          <Link href={nextHref} className="underline underline-offset-2">
            {next ? "Next group" : "Open your checklist"}
          </Link>
          .
        </p>
      ) : needsName ? (
        <p
          role="status"
          className="border-ochre mt-6 rounded-md border p-3 leading-7"
          data-testid="adopt-needs-name"
        >
          {ADOPT_NEEDS_NAME}{" "}
          <Link
            href={ADOPT_NEEDS_NAME_HREF}
            className="underline underline-offset-2"
            data-testid="adopt-needs-name-link"
          >
            {ADOPT_NEEDS_NAME_LINK}
          </Link>
          . The documents are adopted by a named person on a date, and that name
          goes into your document control register.
        </p>
      ) : (
        <AdoptButton
          setId={setId}
          group={groupSlug(group.title)}
          nextHref={nextHref}
          today={new Intl.DateTimeFormat("en-CA", {
            timeZone: "Australia/Sydney",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date())}
        />
      )}
      <p className="mt-8 flex flex-wrap gap-x-6 text-sm print:hidden">
        {previous ? (
          <Link
            href={`/path/adopt/${groupSlug(previous.title)}`}
            className="underline underline-offset-2"
          >
            Back
          </Link>
        ) : null}
        <Link
          href={`/documents/${setId}`}
          className="underline underline-offset-2"
        >
          All documents
        </Link>
      </p>
    </div>
  );
}
