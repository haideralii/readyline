import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FindingRow } from "@/lib/registers/audit-day-types";
import { FINDING_NO_DOCUMENT_LINE } from "@/lib/registers/findings";
import { mapFinding } from "@/lib/registers/findings-map";
import { listVersionSets } from "@/server/generation/queries";

/**
 * REQ-033 FR-4 (D-2933): where the pack answers a finding: the documents
 * whose standards carry its standard, each with the section whose brief
 * names the indicator, linked into the account's newest set, and the
 * registers those documents carry; D-2933's line when no document does.
 */
export async function FindingAnswers({
  row,
  supabase,
  accountId,
}: {
  row: FindingRow;
  supabase: SupabaseClient;
  accountId: string;
}) {
  const sets = await listVersionSets(supabase, accountId);
  const setId = sets[0]?.id ?? null;
  const mapping = mapFinding(row.standard_id, row.indicator);
  return (
    <section
      aria-labelledby="finding-answers-heading"
      className="mt-6"
      data-testid="finding-answers"
    >
      <h2 id="finding-answers-heading" className="text-lg font-medium">
        Where your pack answers this
      </h2>
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
            </li>
          ))}
          {mapping.registers.map((r) => (
            <li key={r} data-testid="finding-answer-register">
              {r}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
