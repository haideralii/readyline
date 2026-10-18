import "server-only";
/**
 * The derived files of a ready set (REQ-017 FR-2, D-1702; REQ-029 FR-2,
 * FR-3, D-2855): the readiness summary, the README, the Start here sheet
 * and the zip, rendered from the stored models through the two read-time
 * fills, so the provider never opens Word to fill a blank and no document
 * version is ever inserted for a fact. Deterministic and model-free. Uses
 * the admin client for storage the way the job does (D-538).
 */
import { strToU8, zipSync } from "fflate";
import type { SupabaseClient } from "@supabase/supabase-js";
import { collectBlanks, type DocumentBlank } from "@/lib/generator/blanks";
import { renderSummaryPdf } from "@/lib/generator/pdf-summary";
import { renderDocx } from "@/lib/generator/render-docx";
import { auditOrder } from "@/lib/generator/set-order";
import { log } from "@/lib/logging/logger";
import { reasonForCi } from "./failure-code";
import { documentControlForSet } from "@/server/registers/document-control-queries";
import { START_HERE_FILE } from "@/lib/generator/start-here";
import { listAdoptedTypeIds } from "@/server/path/state";
import { hasActiveSubscription } from "@/server/registers/queries";
import {
  getVersionSet,
  listFirstDocuments,
  listLatestDocuments,
} from "./queries";
import { documentStatus, readmeText } from "./run";
import { renderStartHere, startHereFromRows } from "./start-here";
import { filledForRead, readFillInputs } from "./read-fill";
import { objectPath } from "./storage";
import {
  SupabaseGenerationStore,
  type DocumentVersionRow,
  type VersionSetRow,
} from "./store";

type Summary = {
  title: string;
  status: "ready" | "review";
  fallbackSections: number;
};

function inAuditOrder(
  docs: readonly DocumentVersionRow[],
): DocumentVersionRow[] {
  const ordered = auditOrder(docs.map((d) => d.document_type_id));
  return [...docs].sort(
    (a, b) =>
      ordered.indexOf(a.document_type_id) - ordered.indexOf(b.document_type_id),
  );
}

/**
 * The summary PDF, the README, the Start here sheet and the zip for a set's
 * latest rows, written to storage: the tail of a re-render and the whole of
 * a summary refresh. Reads the document control register and the adopted
 * types afresh, so an adoption made just before shows in the zip.
 */
async function writeSummaryAndZip(input: {
  admin: SupabaseClient;
  store: SupabaseGenerationStore;
  set: VersionSetRow;
  rows: readonly DocumentVersionRow[];
  entries: Record<string, Uint8Array>;
  summaries: Summary[];
  blanks: DocumentBlank[];
  /** REQ-029 FR-10: the facts the sheet's lines read done by. */
  facts: Readonly<Record<string, string>>;
}): Promise<void> {
  const { admin, store, set, rows, entries, summaries, blanks } = input;
  const first = rows[0]?.model;
  if (!first) return;
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
  const startHere = startHereFromRows({
    set,
    first: shipped,
    latest: rows,
    adopted,
    subscribed,
    summaryVersion: "1",
    facts: input.facts,
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
}

/**
 * REQ-029 FR-2, FR-3 (D-2855): the derived files of a set, rebuilt from the
 * stored models through the two fills (`filledForRead`). No document version
 * is inserted for a fact change: the stored model stays the template, and
 * every `.docx` in the zip, the summary's blank list and the Start here
 * sheet are rendered from the filled models here, the adopted ones without
 * the draft mark. A version changes only for content (a regenerated section,
 * a rule change, a re-approval, a new pack).
 */
async function rebuildDerivedFiles(input: {
  admin: SupabaseClient;
  set: VersionSetRow;
  /** The facts to fill with; read from the account when not given. */
  facts?: Readonly<Record<string, string>>;
}): Promise<{ documents: number; blanksLeft: number }> {
  const { admin, set } = input;
  const store = new SupabaseGenerationStore(admin);
  const sorted = inAuditOrder(await listLatestDocuments(admin, set.id));
  const inputs = await readFillInputs(admin, set.account_id);
  if (input.facts) inputs.facts = { ...input.facts };
  const entries: Record<string, Uint8Array> = {};
  const summaries: Summary[] = [];
  const blanks: DocumentBlank[] = [];
  let providerInputSections = 0;
  for (const d of sorted) {
    const filled = filledForRead(d, inputs);
    entries[`${d.document_type_id}.docx`] = new Uint8Array(
      await renderDocx(filled, { adopted: Boolean(d.adopted_on) }),
    );
    const s = documentStatus(filled);
    summaries.push({
      title: filled.title,
      status: s.status,
      fallbackSections: s.fallbackSections,
    });
    providerInputSections += s.providerInputSections;
    blanks.push(...collectBlanks(filled));
  }
  if (sorted.length) {
    await writeSummaryAndZip({
      admin,
      store,
      set,
      rows: sorted,
      entries,
      summaries,
      blanks,
      facts: inputs.facts,
    });
    await admin
      .from("version_sets")
      .update({ provider_input_section_count: providerInputSections })
      .eq("id", set.id);
  }
  return { documents: sorted.length, blanksLeft: blanks.length };
}

/**
 * The Finish page's step and the facts' rebuild (REQ-017 FR-2 as REQ-029
 * FR-2 reads it): the zip and the summary carry the facts; `changed` is
 * always 0 now, kept in the line for the runs that read it.
 */
export async function rerenderSetWithFacts(input: {
  admin: SupabaseClient;
  set: VersionSetRow;
  facts: Readonly<Record<string, string>>;
}): Promise<{ changed: number; blanksLeft: number }> {
  const startedAt = Date.now();
  const out = await rebuildDerivedFiles(input);
  // `ms` says how long a whole-set rebuild took on the host (runs
  // 38665790472 and 38826340580). D-2266 (PO 16 Oct 21:30, #78's run
  // 38881965824): CI's web server surfaces warn and above alone, so in CI
  // the line is written at warn and the number reaches the job log;
  // production keeps it at info.
  const fields = {
    accountId: input.set.account_id,
    versionSetId: input.set.id,
    changed: 0,
    documents: out.documents,
    blanksLeft: out.blanksLeft,
    ms: Date.now() - startedAt,
  };
  if (reasonForCi()) log.warn("path.finish.rerendered", fields);
  else log.info("path.finish.rerendered", fields);
  return { changed: 0, blanksLeft: out.blanksLeft };
}

/**
 * REQ-024 A0 (D-2441): the pass after an adoption; since REQ-029 the same
 * rebuild, so the zip's adopted documents carry the snapshot and lose the
 * draft mark. No document version is inserted.
 */
export async function refreshSetSummary(
  admin: SupabaseClient,
  setId: string,
): Promise<{ documents: number }> {
  const set = await getVersionSet(admin, setId);
  if (!set) return { documents: 0 };
  const out = await rebuildDerivedFiles({ admin, set });
  log.info("path.adopt.summary-refreshed", {
    accountId: set.account_id,
    versionSetId: set.id,
    documents: out.documents,
  });
  return { documents: out.documents };
}
