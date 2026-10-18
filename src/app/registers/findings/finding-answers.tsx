import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FindingRow } from "@/lib/registers/audit-day-types";
import { FINDING_NO_DOCUMENT_LINE } from "@/lib/registers/findings";
import { mapFinding } from "@/lib/registers/findings-map";
import {
  REDRAFT_BUTTON_LABEL,
  noRedraftReason,
  redraftStateLine,
} from "@/lib/registers/findings-redraft";
import {
  getDocumentVersion,
  listLatestDocuments,
  listVersionSets,
} from "@/server/generation/queries";

/**
 * REQ-033 FR-4 (D-2933): where the pack answers a finding: the documents
 * whose standards carry its standard, each with the section whose brief
 * names the indicator, linked into the account's newest set, and the
 * registers those documents carry; D-2933's line when no document does.
 * REQ-033 Session B FR-B1, FR-B6: each line with a tailored section in a
 * document the set holds gets the redraft link; the others say why not; a
 * finding already redrafted shows the version and whether it is adopted.
 */
export async function FindingAnswers({
  row,
  supabase,
  accountId,
  canWrite,
}: {
  row: FindingRow;
  supabase: SupabaseClient;
  accountId: string;
  canWrite: boolean;
}) {
  const sets = await listVersionSets(supabase, accountId);
  const setId = sets[0]?.id ?? null;
  const mapping = mapFinding(row.standard_id, row.indicator);
  const inSet = new Set(
    setId
      ? (await listLatestDocuments(supabase, setId)).map(
          (d) => d.document_type_id,
        )
      : [],
  );
  const redraft = row.redraft_version_id
    ? await getDocumentVersion(supabase, row.redraft_version_id)
    : null;
  const redraftTitle = redraft
    ? (mapping.documents.find((d) => d.typeId === redraft.document_type_id)
        ?.title ?? redraft.document_type_id)
    : "";
  return (
    <section
      aria-labelledby="finding-answers-heading"
      className="mt-6"
      data-testid="finding-answers"
    >
      <h2 id="finding-answers-heading" className="text-lg font-medium">
        Where your pack answers this
      </h2>
      {redraft ? (
        <p className="mt-2 leading-7" data-testid="finding-redraft-state">
          {redraftStateLine({
            title: redraftTitle,
            version: redraft.version,
            adoptedOn: redraft.adopted_on ?? null,
          })}
          {setId ? (
            <>
              {" "}
              <Link
                href={`/documents/${setId}/${redraft.document_type_id}`}
                className="underline underline-offset-4"
                data-testid="finding-redraft-version-link"
              >
                Open the version
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
      {!row.standard_id ? (
        <p className="mt-2 leading-7" data-testid="finding-unmapped">
          Pick the standard on this finding to see which document answers it.
        </p>
      ) : mapping.documents.length === 0 ? (
        <p className="mt-2 leading-7" data-testid="finding-no-document">
          {FINDING_NO_DOCUMENT_LINE}{" "}
          <Link href="/documents" className="underline underline-offset-4">
            See your documents
          </Link>
        </p>
      ) : (
        <ul
          className="mt-2 space-y-1 leading-7"
          data-testid="finding-answered-in"
        >
          {mapping.documents.map((d) => (
            <li key={d.typeId} data-testid="finding-answer">
              {
                <Link
                  href={
                    setId ? `/documents/${setId}/${d.typeId}` : "/documents"
                  }
                  className="underline underline-offset-4"
                  data-testid="finding-answer-link"
                >
                  {d.title}
                </Link>
              }
              {d.section ? (
                <span className="text-ink">
                  , section {d.section.number} {d.section.heading}
                </span>
              ) : null}
              {/* REQ-033 Session B FR-B1: the redraft link, or the one-sentence reason there is none. */}
              {canWrite &&
              d.section?.mode === "tailored" &&
              inSet.has(d.typeId) ? (
                <>
                  {" "}
                  <Link
                    href={`/registers/findings/${row.id}/redraft/${d.typeId}`}
                    className="underline underline-offset-4"
                    data-testid="finding-redraft-link"
                  >
                    {REDRAFT_BUTTON_LABEL}
                  </Link>
                </>
              ) : canWrite ? (
                <span
                  className="text-slate block text-sm"
                  data-testid="finding-no-redraft"
                >
                  {noRedraftReason(
                    !d.section
                      ? "unmapped"
                      : d.section.mode !== "tailored"
                        ? "fixed"
                        : "no-version",
                  )}
                </span>
              ) : null}
            </li>
          ))}
          {mapping.registers.map((r) => (
            <li key={r} data-testid="finding-answer-register">
              {r}
              {canWrite ? (
                <span
                  className="text-slate block text-sm"
                  data-testid="finding-no-redraft"
                >
                  {noRedraftReason("register")}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
