import { PageShell } from "@/components/page-shell";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { GlossaryTerms } from "@/components/glossary-terms";
import { findGlossaryTerms } from "@/lib/copy-lint/glossary";
import { documentTypeById } from "@/lib/generator/catalogue";
import { groupSlug, orderDocuments } from "@/lib/generator/set-order";
import {
  ADOPT_NEEDS_NAME,
  ADOPT_NEEDS_NAME_LINK,
  detailsHref,
} from "@/lib/path/adopt-copy";
import { getViewer } from "@/server/accounts/queries";
import { loadFacts } from "@/server/path/facts";
import { loadPathContext } from "@/server/path/state";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { AdoptButton } from "../adopt-button";

export const metadata: Metadata = { title: "Adopt your documents" };

const ADOPT_INTRO =
  "Read the names below. Tap a name to read the document. When they say what you do, press the button and they become your policies. That is what it means to adopt.";
const ADOPTED_LINE = "Adopted. These are your policies now.";
const NAMED_PERSON_LINE =
  "The documents are adopted by a named person on a date, and that name goes into your document control register.";

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
  // REQ-027 FR-3, D-2711, D-2267 (#81's run 38909477898): the document names
  // and their purposes carry glossary words of their own (the incident
  // register names reportable incidents), so the page is not one-term and
  // takes the disclosure, computed at render from the words it shows.
  const present = findGlossaryTerms(
    [
      ADOPT_INTRO,
      group.title,
      ...group.documents.flatMap((d) => [
        d.model.title,
        documentTypeById(d.document_type_id)?.purpose ?? "",
      ]),
      ADOPTED_LINE,
      ADOPT_NEEDS_NAME,
      ADOPT_NEEDS_NAME_LINK,
      NAMED_PERSON_LINE,
    ].join("\n"),
  );
  return (
    <PageShell kind="form">
      <p className="text-slate text-sm">
        Adopt your documents: group {index + 1} of {groups.length}
      </p>
      <h1 className="mt-2">{group.title}</h1>
      <p className="mt-3 leading-7">{ADOPT_INTRO}</p>
      <GlossaryTerms ids={present} where="page" className="mt-3" />
      <ul className="divide-rule mt-6 divide-y" data-testid="adopt-list">
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
              <p className="text-ink mt-1 text-sm leading-6">
                {type?.purpose ?? ""}
              </p>
            </li>
          );
        })}
      </ul>
      {adopted ? (
        <p role="status" className="mt-6 leading-7" data-testid="adopt-done">
          {ADOPTED_LINE}{" "}
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
            href={detailsHref(setId)}
            className="underline underline-offset-2"
            data-testid="adopt-needs-name-link"
          >
            {ADOPT_NEEDS_NAME_LINK}
          </Link>
          . {NAMED_PERSON_LINE}
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
    </PageShell>
  );
}
