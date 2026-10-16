import { PageShell } from "@/components/page-shell";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { diffLines } from "@/lib/generator/diff";
import { describeFactSources } from "@/lib/generator/fact-sources";
import { blocksToText } from "@/lib/generator/section-schema";
import { Blocks } from "@/components/sample-document";
import {
  changesForDocument,
  describeChange,
  loadWatchChanges,
} from "@/lib/registers/living-policies";
import { getViewer } from "@/server/accounts/queries";
import {
  getVersionSet,
  listDocumentVersions,
} from "@/server/generation/queries";
import { isSetLocked } from "@/server/payments/queries";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { AdoptVersionButton } from "./adopt-version-button";
import { RegenerateButton } from "./regenerate-button";

export const metadata: Metadata = { title: "Review document" };

export default async function ReviewDocumentPage({
  params,
  searchParams,
}: PageProps<"/documents/[setId]/[typeId]">) {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=%2Fdocuments");
  if (!viewer.account) redirect("/account/setup");
  const { setId, typeId } = await params;
  const sp = await searchParams;
  const supabase = await createSupabaseServerClient();
  const set = await getVersionSet(supabase, setId);
  if (!set || set.account_id !== viewer.account.id) notFound();
  // REQ-007 FR-8: a refunded pack is not shown.
  if (await isSetLocked(supabase, set.id)) redirect(`/documents/${set.id}`);
  const versions = await listDocumentVersions(supabase, set.id, typeId);
  if (versions.length === 0) notFound();
  const current = versions[0];
  const previous = versions[1] ?? null;
  const changedSection = typeof sp.changed === "string" ? sp.changed : null;
  // REQ-024 A0 (D-2427, D-2436): adoption is per version. The newest adopted
  // version of this document in the set, if any, for the line and the
  // re-adopt action when this latest version is not the one adopted.
  const olderAdopted = versions.find((v) => v.adopted_on)?.adopted_on ?? null;
  // Backlog 8 (D-551): rule changes applied since this version was drafted that it does not carry.
  const ruleChanges = changesForDocument(
    {
      typeId,
      createdAt: current.created_at,
      sections: current.model.sections.map((s) => ({
        id: s.id,
        text: blocksToText(s.blocks),
      })),
    },
    loadWatchChanges(),
  );

  return (
    <PageShell kind="reading">
      <p className="text-sm">
        <Link
          href={`/documents/${set.id}`}
          className="underline underline-offset-2"
        >
          Back to the set
        </Link>
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        {current.model.title}
      </h1>
      <p className="text-slate mt-2 text-sm">
        Version {current.version} ·{" "}
        {current.status === "ready" ? "drafted" : "review needed"} ·{" "}
        {current.adopted_on ? (
          <span data-testid="version-adopted-on">
            adopted {current.adopted_on} ·{" "}
          </span>
        ) : null}
        <a
          href={`/documents/${set.id}/download?file=${typeId}.docx`}
          className="underline underline-offset-2"
        >
          Download .docx
        </a>
      </p>
      <p className="text-ink mt-3 text-sm leading-6">
        Each tailored section shows which of your answers it used. Regenerating
        a section records a new version of this document and shows what changed.
      </p>
      {!current.adopted_on && olderAdopted ? (
        <AdoptVersionButton
          setId={set.id}
          typeId={typeId}
          version={current.version}
          olderAdoptedOn={olderAdopted}
        />
      ) : null}
      {ruleChanges.length ? (
        <div
          className="border-ochre mt-4 rounded-md border p-3 text-sm leading-6"
          data-testid="rule-changes"
        >
          <p className="font-medium">
            {ruleChanges.length === 1
              ? "A rule changed since this version was drafted."
              : `${ruleChanges.length} rules changed since this version was drafted.`}
          </p>
          <ul className="mt-1 list-disc pl-5">
            {ruleChanges.map((c) => (
              <li key={c.changeId}>
                {c.sectionId ? `Section "${c.sectionId}": ` : ""}
                {describeChange(c)} Now: &ldquo;{c.newSentence}&rdquo;
              </li>
            ))}
          </ul>
          <p className="mt-1">
            Re-generate the section below, or record your check on the{" "}
            <Link
              href="/registers/document-control"
              className="underline underline-offset-2"
            >
              document control register
            </Link>
            .
          </p>
        </div>
      ) : null}

      <ol className="mt-8 space-y-6">
        {current.model.sections.map((s) => {
          const prev = previous?.model.sections.find((p) => p.id === s.id);
          const showDiff = changedSection === s.id && prev;
          const diff = showDiff
            ? diffLines(blocksToText(prev.blocks), blocksToText(s.blocks))
            : null;
          return (
            <li
              key={s.id}
              className="border-rule rounded-md border p-4"
              data-testid={`section-${s.id}`}
            >
              <h2 className="text-lg font-semibold">
                {s.number ? `${s.number} ` : ""}
                {s.heading}
              </h2>
              <p className="text-slate mt-1 text-xs">
                {s.mode === "fixed"
                  ? "Fixed text"
                  : s.status === "generated"
                    ? "Drafted by AI from your answers"
                    : "Not drafted: review and complete"}
              </p>
              {s.mode === "tailored" && s.usedFacts?.length ? (
                <p className="text-ink mt-2 text-sm">
                  Used your answers:{" "}
                  {describeFactSources(s.usedFacts)
                    .map((f) => `${f.question} (step ${f.step})`)
                    .join("; ")}
                </p>
              ) : null}
              {/* REQ-013 batch 36 item 1: the same block renderer as the sample, so tables stack on phones. */}
              <div className="mt-3 text-sm">
                <Blocks blocks={s.blocks} />
              </div>
              {diff ? (
                <div
                  className="bg-mist mt-3 rounded-md p-3 text-sm"
                  data-testid="section-diff"
                >
                  <p className="font-medium">
                    What changed from version {previous!.version}
                  </p>
                  <ul className="mt-2 space-y-1 font-mono text-xs">
                    {diff.map((l, i) => (
                      <li
                        key={i}
                        className={
                          l.kind === "added"
                            ? "text-green-800 dark:text-green-300"
                            : l.kind === "removed"
                              ? "text-red-800 line-through dark:text-red-300"
                              : "text-slate"
                        }
                      >
                        {l.kind === "added"
                          ? "+ "
                          : l.kind === "removed"
                            ? "- "
                            : "  "}
                        {l.text}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {s.mode === "tailored" ? (
                <RegenerateButton
                  versionId={current.id}
                  sectionId={s.id}
                  setId={set.id}
                  typeId={typeId}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </PageShell>
  );
}
