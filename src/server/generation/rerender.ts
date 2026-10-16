import "server-only";
/**
 * Re-renders a ready set with the account's facts filled into every blank
 * (REQ-017 FR-2, D-1702): a new document version per document whose text
 * changed, a fresh readiness summary and a fresh zip, so the provider never
 * opens Word to fill a blank. Deterministic and model-free: the stored
 * models are the input. Uses the admin client for storage and the version
 * rows the way the job does (D-538).
 */
import { strToU8, zipSync } from "fflate";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adoptionsByType, applyAdoption } from "@/lib/generator/adoption";
import { collectBlanks, type DocumentBlank } from "@/lib/generator/blanks";
import { applyFacts } from "@/lib/generator/facts-fill";
import { renderSummaryPdf } from "@/lib/generator/pdf-summary";
import { renderDocx } from "@/lib/generator/render-docx";
import { auditOrder } from "@/lib/generator/set-order";
import { log } from "@/lib/logging/logger";
import { reasonForCi } from "./failure-code";
import { documentControlForSet } from "@/server/registers/document-control-queries";
import { START_HERE_FILE } from "@/lib/generator/start-here";
import { listAdoptedTypeIds } from "@/server/path/state";
import { hasActiveSubscription } from "@/server/registers/queries";
import { listFirstDocuments, listLatestDocuments } from "./queries";
import { DOCX_TYPE, documentStatus, readmeText } from "./run";
import { renderStartHere, startHereFromRows } from "./start-here";
import { objectPath } from "./storage";
import { SupabaseGenerationStore, type VersionSetRow } from "./store";

export async function rerenderSetWithFacts(input: {
  admin: SupabaseClient;
  set: VersionSetRow;
  facts: Readonly<Record<string, string>>;
}): Promise<{ changed: number; blanksLeft: number }> {
  const { admin, set, facts } = input;
  const startedAt = Date.now();
  const store = new SupabaseGenerationStore(admin);
  const docs = await listLatestDocuments(admin, set.id);
  const ordered = auditOrder(docs.map((d) => d.document_type_id));
  const sorted = [...docs].sort(
    (a, b) =>
      ordered.indexOf(a.document_type_id) - ordered.indexOf(b.document_type_id),
  );
  let changed = 0;
  const entries: Record<string, Uint8Array> = {};
  const summaries: {
    title: string;
    status: "ready" | "review";
    fallbackSections: number;
  }[] = [];
  const blanks: DocumentBlank[] = [];
  let providerInputSections = 0;
  // Retro review of REQ-018 to 021, finding 3 (PO decision 3): an adopted
  // document's own control table carries the register's adoption date and
  // next review date, so the Word file and the summary's first page agree.
  // Read before the loop; the summary reads the register again after it so
  // its version column is current.
  const adoptions = adoptionsByType(
    await documentControlForSet(admin, set.account_id, set.id),
  );
  for (const d of sorted) {
    const withFacts = applyFacts(d.model, facts);
    const adoption = adoptions.get(d.document_type_id);
    const filled = adoption ? applyAdoption(withFacts, adoption) : withFacts;
    const same = JSON.stringify(filled) === JSON.stringify(d.model);
    let row = d;
    if (!same) {
      const docx = await renderDocx(filled);
      const version = d.version + 1;
      const path = objectPath(
        set.account_id,
        set.id,
        `${d.document_type_id}.v${version}.docx`,
      );
      await store.putObject(path, new Uint8Array(docx), DOCX_TYPE);
      const { status } = documentStatus(filled);
      row = await store.insertDocumentVersion({
        version_set_id: set.id,
        account_id: set.account_id,
        document_type_id: d.document_type_id,
        version,
        status,
        storage_path: path,
        model: filled,
      });
      changed += 1;
    }
    const s = documentStatus(row.model);
    summaries.push({
      title: row.model.title,
      status: s.status,
      fallbackSections: s.fallbackSections,
    });
    providerInputSections += s.providerInputSections;
    blanks.push(...collectBlanks(row.model));
    entries[`${row.document_type_id}.docx`] = await store.getObject(
      row.storage_path,
    );
  }
  const first = sorted[0]?.model;
  if (first) {
    const generatedAt = set.created_at.slice(0, 10);
    // REQ-018 FR-13: the document control register as the summary's first page (adoption re-renders here).
    const documentControl = await documentControlForSet(
      admin,
      set.account_id,
      set.id,
    );
    const pdf = await renderSummaryPdf({
      facts: first.facts,
      result: set.derived_result,
      documents: summaries,
      blanks,
      documentControl,
      generatedAt,
      version: "1",
    });
    await store.putObject(
      objectPath(set.account_id, set.id, "readiness-summary.pdf"),
      pdf,
      "application/pdf",
    );
    entries["readiness-summary.pdf"] = pdf;
    entries["README.txt"] = strToU8(
      readmeText(first.facts.tradingName, generatedAt),
    );
    // REQ-026 FR-5: the sheet regenerates with the pack, first in the zip; filled lines read done.
    const [shipped, adopted, subscribed] = await Promise.all([
      listFirstDocuments(admin, set.id),
      listAdoptedTypeIds(admin, set.account_id),
      hasActiveSubscription(admin, set.account_id),
    ]);
    const latestRows = await listLatestDocuments(admin, set.id);
    const startHere = startHereFromRows({
      set,
      first: shipped,
      latest: latestRows,
      adopted,
      subscribed,
      summaryVersion: "1",
    });
    const ordered: Record<string, Uint8Array> = startHere
      ? {
          [START_HERE_FILE]: new Uint8Array(await renderStartHere(startHere)),
          ...entries,
        }
      : entries;
    await store.putObject(
      objectPath(set.account_id, set.id, "set.zip"),
      zipSync(ordered, { level: 6 }),
      "application/zip",
    );
    await admin
      .from("version_sets")
      .update({ provider_input_section_count: providerInputSections })
      .eq("id", set.id);
  }
  // The guided-path spec waits on this step; `ms` says how long a whole-set
  // re-render took on the host (runs 38665790472 and 38826340580). D-2266
  // (PO 16 Oct 21:30, #78's run 38881965824): CI's web server surfaces warn
  // and above alone, so in CI the line is written at warn and the number
  // reaches the job log; production keeps it at info.
  const fields = {
    accountId: set.account_id,
    versionSetId: set.id,
    changed,
    documents: sorted.length,
    blanksLeft: blanks.length,
    ms: Date.now() - startedAt,
  };
  if (reasonForCi()) log.warn("path.finish.rerendered", fields);
  else log.info("path.finish.rerendered", fields);
  return { changed, blanksLeft: blanks.length };
}
