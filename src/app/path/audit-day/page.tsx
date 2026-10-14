import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GENERAL_INFORMATION_STATEMENT } from "@/lib/brand";
import { deriveChecklist } from "@/lib/checklist/derive";
import { mergeChecklist, type ShownItem } from "@/lib/checklist/state";
import { orderDocuments } from "@/lib/generator/set-order";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { getViewer } from "@/server/accounts/queries";
import {
  listChecklistItems,
  listDraftedDocumentTypeIds,
} from "@/server/checklist/queries";
import { loadPathContext } from "@/server/path/state";
import { createSupabaseServerClient } from "@/server/supabase/server";

export const metadata: Metadata = { title: "Audit day" };

/**
 * Step 7, the audit-day page (REQ-017 FR-3, D-1703): what the auditor will
 * ask for, in the order they ask (your business, your documents, your
 * registers, your people, the audit itself), written as the conversation,
 * with a tick for each thing the provider has, the pack download and the
 * readiness summary. Printable: the print sheet keeps the list.
 */
const ASK: Record<string, string> = {
  business: "First they check who you are",
  documents: "Then they ask to see your policies",
  registers: "Then they ask for your records",
  people: "Then they ask about your workers",
  audit: "Then they talk about the audit itself",
};

function tick(item: ShownItem): { mark: string; word: string } {
  if (item.status === "have") return { mark: "✓", word: "You have it." };
  if (item.status === "drafted" || item.status === "in-progress")
    return { mark: "◐", word: "Nearly there." };
  return { mark: "○", word: "Not yet." };
}

export default async function AuditDayPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=%2Fpath%2Faudit-day");
  if (viewer.deleted) redirect("/account/deleted");
  if (!viewer.account) redirect("/account/setup");
  const supabase = await createSupabaseServerClient();
  const ctx = await loadPathContext(supabase, {
    ...viewer,
    account: viewer.account,
  });
  if (!ctx.result || !ctx.answers) redirect("/start");
  const dataset = getStandardsDataset();
  const [stored, drafted] = await Promise.all([
    listChecklistItems(supabase, viewer.account.id),
    listDraftedDocumentTypeIds(supabase, viewer.account.id),
  ]);
  const shown = mergeChecklist({
    checklist: deriveChecklist(ctx.result, ctx.answers, dataset),
    stored,
    draftedDocumentTypeIds: drafted,
  });
  const setId = ctx.state.readySetId;
  const groups = setId ? orderDocuments(ctx.documents) : [];
  const have = shown.items.filter((i) => i.status === "have").length;
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-semibold tracking-tight">
        Audit day: {viewer.account.trading_name}
      </h1>
      <p className="mt-3 leading-7" data-testid="audit-day-summary">
        {ctx.result.pathway === "verification"
          ? "The auditor reads your documents at their desk and may phone you with questions. "
          : "The auditor visits, reads your documents, and talks to you, your workers and some participants. "}
        You have {have} of {shown.total} things ready. Print this page and keep
        it with your pack.
      </p>
      <p className="mt-4 print:hidden">
        {setId ? (
          <a
            href={`/documents/${setId}/download?file=set.zip`}
            className="btn-primary"
            data-testid="audit-day-download"
          >
            Download my pack
          </a>
        ) : (
          <Link href="/documents" className="btn-primary">
            Get my documents
          </Link>
        )}
      </p>
      {setId ? (
        <p className="mt-3 text-sm print:hidden">
          <a
            href={`/documents/${setId}/download?file=readiness-summary.pdf`}
            className="underline underline-offset-2"
          >
            Readiness summary (PDF)
          </a>
        </p>
      ) : null}

      {shown.groups.map((g) => (
        <section
          key={g.id}
          aria-labelledby={`ask-${g.id}`}
          className="mt-10"
          data-testid="audit-day-group"
        >
          <h2 id={`ask-${g.id}`} className="text-xl font-semibold">
            {ASK[g.id] ?? g.title}
          </h2>
          <ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
            {g.items.map((i) => {
              const t = tick(i);
              return (
                <li key={i.id} className="flex gap-3 py-3 leading-7">
                  <span aria-hidden="true" className="w-5 shrink-0">
                    {t.mark}
                  </span>
                  <span>
                    <span className="font-medium">
                      &quot;Show me: {i.title}.&quot;
                    </span>{" "}
                    <span className="text-zinc-700 dark:text-zinc-300">
                      {t.word}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {groups.length ? (
        <section
          aria-labelledby="pack-heading"
          className="mt-10"
          data-testid="audit-day-pack"
        >
          <h2 id="pack-heading" className="text-xl font-semibold">
            The documents in your pack
          </h2>
          {groups.map((g) => (
            <div key={g.title} className="mt-3">
              <h3 className="text-base font-semibold">{g.title}</h3>
              <ul className="mt-1 list-disc pl-5 leading-7">
                {g.documents.map((d) => (
                  <li key={d.id}>
                    {d.model.title}
                    {ctx.adopted.has(d.document_type_id) ? " (adopted)" : ""}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}
      <p className="mt-10 text-xs text-zinc-600 dark:text-zinc-400">
        {GENERAL_INFORMATION_STATEMENT}
      </p>
    </div>
  );
}
