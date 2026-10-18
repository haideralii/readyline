"use server";
/**
 * The guided path's actions (REQ-017 FR-2, FR-3; D-1702, D-1703): save one
 * fact, finish the pack (re-render every document with the facts), and
 * adopt a document group (checklist Done for each document, the policy
 * review's adopted date, the approval date fact, the draft marks gone).
 * Every boundary parses a strict object (REQ-002 FR-3); the owner's session
 * drives every read and write except the storage re-render, which uses the
 * admin client the way the job does, after the set is proven to be theirs.
 */
import { z } from "zod";
import { listAdoptedDates, openBlanks } from "./state";
import { checklistPeriod, deriveChecklist } from "@/lib/checklist/derive";
import { groupSlug, orderDocuments } from "@/lib/generator/set-order";
import { log } from "@/lib/logging/logger";
import { parseInput, strictObject } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import {
  getVersionSet,
  listLatestDocuments,
} from "@/server/generation/queries";
import { reasonForCi } from "@/server/generation/failure-code";
import {
  refreshSetSummary,
  rerenderSetWithFacts,
} from "@/server/generation/rerender";
import { countEvent } from "@/server/metrics/counters";
import { latestOwnershipChangeOn } from "@/server/registers/commission-changes-queries";
import { currentPeriod } from "@/server/registers/registration-queries";
import { markAdopted, seedPolicyReviews } from "@/server/registers/seed";
import { needsReapproval, reapprovalModel } from "@/lib/generator/reapproval";
import { renderDocx } from "@/lib/generator/render-docx";
import { sydneyDay } from "@/lib/metrics/counters";
import { DOCX_TYPE, documentStatus } from "@/server/generation/run";
import { objectPath } from "@/server/generation/storage";
import { SupabaseGenerationStore } from "@/server/generation/store";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { getStandardsDataset } from "@/lib/standards/dataset";
import {
  ADOPT_NEEDS_NAME,
  ADOPT_NEEDS_NAME_LINK,
  detailsHref,
  NOT_CURRENT_PACK,
} from "@/lib/path/adopt-copy";
import { latestReadySet } from "@/server/checklist/queries";
import { loadFacts, saveFact } from "./facts";
import { isFactValueAllowed } from "@/lib/generator/facts-fill";
import {
  DETAILS_CLEARED_ACTION,
  DETAILS_REAPPROVED_ACTION,
  DETAILS_REFUSED,
  DETAILS_SAVED_ACTION,
  DETAILS_SAVE_FAILED,
  DETAILS_TOO_LONG,
} from "@/lib/path/details-copy";
import { loadQuestionnaire } from "./state";

export type PathActionResult =
  | { ok: true; blanksLeft?: number; changed?: number }
  | { ok: false; message: string; href?: string; hrefLabel?: string };

const FactKey = z.string().regex(/^[a-z][a-z0-9-]{0,39}$/);
const FactInput = strictObject({
  key: FactKey,
  value: z.string().trim().min(1).max(200),
});
const ClearInput = strictObject({ key: FactKey });

/** REQ-029 SR-3: the audit line carries the key, never the value. */
async function auditDetail(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  accountId: string,
  userId: string,
  action: string,
  key: string,
) {
  const audit = await supabase.from("audit_log").insert({
    account_id: accountId,
    actor_user_id: userId,
    action,
    target: key,
  });
  if (audit.error)
    log.warn("audit.write.failed", { action, code: audit.error.code });
}

export async function saveFactAction(
  input: unknown,
): Promise<PathActionResult> {
  // REQ-029 SR-6: square brackets and control characters are refused in
  // words, so a value is never read as a blank; the length rule stays.
  const raw = (input as { value?: unknown } | null)?.value;
  if (typeof raw === "string" && !isFactValueAllowed(raw))
    return { ok: false, message: DETAILS_REFUSED };
  const parsed = parseInput(FactInput, input);
  if (!parsed.ok) return { ok: false, message: DETAILS_TOO_LONG };
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted)
    return { ok: false, message: "Sign in to save your answers." };
  const supabase = await createSupabaseServerClient();
  const r = await saveFact(
    supabase,
    viewer.account.id,
    parsed.data.key,
    parsed.data.value,
  );
  if (!r.ok) {
    log.warn("path.fact.save-failed", {
      accountId: viewer.account.id,
      code: r.code,
    });
    return { ok: false, message: DETAILS_SAVE_FAILED };
  }
  // The account form writes the role under both keys (D-1704); the details page keeps them in step.
  if (parsed.data.key === "role")
    await saveFact(
      supabase,
      viewer.account.id,
      "owner-role",
      parsed.data.value,
    );
  await auditDetail(
    supabase,
    viewer.account.id,
    viewer.user.id,
    DETAILS_SAVED_ACTION,
    parsed.data.key,
  );
  return { ok: true };
}

/** REQ-029 FR-4: a cleared field deletes its row, so the blank shows again in every file. */
export async function clearFactAction(
  input: unknown,
): Promise<PathActionResult> {
  const parsed = parseInput(ClearInput, input);
  if (!parsed.ok) return { ok: false, message: DETAILS_SAVE_FAILED };
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted)
    return { ok: false, message: "Sign in to save your answers." };
  const supabase = await createSupabaseServerClient();
  const keys =
    parsed.data.key === "role" ? ["role", "owner-role"] : [parsed.data.key];
  const r = await supabase
    .from("account_facts")
    .delete()
    .eq("account_id", viewer.account.id)
    .in("key", keys);
  if (r.error) {
    log.warn("path.fact.clear-failed", {
      accountId: viewer.account.id,
      code: r.error.code,
    });
    return { ok: false, message: DETAILS_SAVE_FAILED };
  }
  await auditDetail(
    supabase,
    viewer.account.id,
    viewer.user.id,
    DETAILS_CLEARED_ACTION,
    parsed.data.key,
  );
  return { ok: true };
}

const SetInput = strictObject({ setId: z.string().uuid() });

/**
 * REQ-029 FR-6 (D-2855): a changed name or role behind an adopted document
 * is a re-approval. Each adopted latest version whose snapshot differs from
 * the account's facts gets a new version (the same template with the
 * version moved and a change-log row that reads "Approver changed to
 * [role]; re-approved", the earlier rows fixed to the earlier approver),
 * adopted at once through `adopt_document_version`, which takes today's
 * snapshot; one audit line per document, the type and the version, never
 * a value. A changed phone or email never comes here (the next download
 * carries it).
 */
export async function reapproveAction(
  input: unknown,
): Promise<PathActionResult & { reapproved?: number }> {
  const parsed = parseInput(SetInput, input);
  if (!parsed.ok) return { ok: false, message: "That set was not found." };
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted)
    return { ok: false, message: "Sign in to re-approve your documents." };
  const accountId = viewer.account.id;
  const supabase = await createSupabaseServerClient();
  const set = await getVersionSet(supabase, parsed.data.setId);
  if (!set || set.account_id !== accountId || set.status !== "ready")
    return { ok: false, message: "That set was not found." };
  const facts = await loadFacts(supabase, accountId);
  if (!facts.name?.trim())
    return {
      ok: false,
      message: ADOPT_NEEDS_NAME,
      href: detailsHref(set.id),
      hrefLabel: ADOPT_NEEDS_NAME_LINK,
    };
  const newest = await latestReadySet(supabase, accountId);
  if (newest.setId !== set.id) return { ok: false, message: NOT_CURRENT_PACK };
  const admin = createSupabaseAdminClient();
  const store = new SupabaseGenerationStore(admin);
  const today = sydneyDay();
  let reapproved = 0;
  for (const d of await listLatestDocuments(supabase, set.id)) {
    if (!needsReapproval(d, facts)) continue;
    const version = d.version + 1;
    const model = reapprovalModel(d.model, {
      version,
      today,
      previous: {
        name: d.approver_name ?? "",
        role: d.approver_role ?? null,
      },
    });
    const path = objectPath(
      accountId,
      set.id,
      `${d.document_type_id}.v${version}.docx`,
    );
    await store.putObject(
      path,
      new Uint8Array(await renderDocx(model)),
      DOCX_TYPE,
    );
    await store.insertDocumentVersion({
      version_set_id: set.id,
      account_id: accountId,
      document_type_id: d.document_type_id,
      version,
      status: documentStatus(model).status,
      storage_path: path,
      model,
    });
    const day = await markAdopted(admin, accountId, d.document_type_id, set.id);
    if (!day) {
      log.warn("path.reapprove.not-adopted", {
        accountId,
        versionSetId: set.id,
        documentTypeId: d.document_type_id,
        version,
      });
      continue;
    }
    const audit = await admin.from("audit_log").insert({
      account_id: accountId,
      actor_user_id: viewer.user.id,
      action: DETAILS_REAPPROVED_ACTION,
      target: `${d.document_type_id}:${version}`,
    });
    if (audit.error)
      log.warn("audit.write.failed", {
        action: DETAILS_REAPPROVED_ACTION,
        code: audit.error.code,
      });
    reapproved += 1;
  }
  if (reapproved > 0) await refreshSetSummary(admin, set.id);
  log.info("path.reapproved", { accountId, versionSetId: set.id, reapproved });
  return { ok: true, reapproved };
}

/** Re-renders the set with every saved fact filled in (FR-2 "re-render on finish"). */
export async function finishPackAction(
  input: unknown,
): Promise<PathActionResult> {
  const parsed = parseInput(SetInput, input);
  if (!parsed.ok) return { ok: false, message: "That set was not found." };
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted)
    return { ok: false, message: "Sign in to finish your pack." };
  const supabase = await createSupabaseServerClient();
  const set = await getVersionSet(supabase, parsed.data.setId);
  if (!set || set.account_id !== viewer.account.id || set.status !== "ready")
    return { ok: false, message: "That set was not found." };
  const facts = await loadFacts(supabase, viewer.account.id);
  let out: Awaited<ReturnType<typeof rerenderSetWithFacts>>;
  try {
    out = await rerenderSetWithFacts({
      admin: createSupabaseAdminClient(),
      set,
      facts,
    });
  } catch (e) {
    // D-2266 (#78's run 38881965824: the android-small finish went quiet,
    // not loud): in CI the throw's name and text reach the job log at warn
    // before it goes on; production logs nothing more than it did.
    if (reasonForCi())
      log.warn("path.finish.failed", {
        accountId: viewer.account.id,
        versionSetId: set.id,
        errorName: e instanceof Error ? e.name : typeof e,
        reasonText: (e instanceof Error ? e.message : String(e)).slice(0, 300),
      });
    throw e;
  }
  // Batch 45 item 12 (D-2002): a pack finished, counted per day, nothing per user.
  if (out.blanksLeft === 0) countEvent("finish-completed");
  return { ok: true, changed: out.changed, blanksLeft: out.blanksLeft };
}

const GroupInput = strictObject({
  setId: z.string().uuid(),
  group: z.string().regex(/^[a-z][a-z0-9-]{0,40}$/),
  /** REQ-018 FR-14: which workers were walked through the group's documents, and when. Optional; codes only. */
  circulation: strictObject({
    worker_refs: z
      .string()
      .trim()
      .toUpperCase()
      .regex(
        /^((W|KP)-?[0-9]{1,6})([ ,]+(W|KP)-?[0-9]{1,6})*$/,
        "Use worker codes like W-1 W-2, never names",
      )
      .transform((v) => v.split(/[ ,]+/).filter(Boolean).join(" ")),
    circulated_on: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date you walked them through"),
    how: z.string().trim().max(200).optional(),
  }).optional(),
});

/**
 * "These are our policies" for one group (step 5): checklist Done for each
 * document in it, the policy review's adopted date, the approval date fact
 * when the provider has not given one, the re-render so the control table
 * carries it, and the policy review register seeded.
 */
export async function adoptGroupAction(
  input: unknown,
): Promise<PathActionResult> {
  const parsed = parseInput(GroupInput, input);
  if (!parsed.ok) return { ok: false, message: "That group was not found." };
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted)
    return { ok: false, message: "Sign in to adopt your documents." };
  const accountId = viewer.account.id;
  const supabase = await createSupabaseServerClient();
  const set = await getVersionSet(supabase, parsed.data.setId);
  if (!set || set.account_id !== accountId || set.status !== "ready")
    return { ok: false, message: "That set was not found." };
  const docs = await listLatestDocuments(supabase, set.id);
  const group = orderDocuments(docs).find(
    (g) => groupSlug(g.title) === parsed.data.group,
  );
  if (!group) return { ok: false, message: "That group was not found." };
  // Batch 47 item 3 (D-2211): a document with a fact blank the Finish form can
  // still fill is not adopted; the signed copy's own marks (signature, date
  // reported) are not blanks here, so they never block adoption.
  const facts = await loadFacts(supabase, accountId);
  const open = openBlanks(docs, facts);
  if (open > 0)
    return {
      ok: false,
      message: `Finish your pack first: ${open} ${open === 1 ? "blank is" : "blanks are"} still open.`,
    };
  // Retro finding 114 (D-2244): adoption is approval by a named person on a
  // date, so it waits for the account's name fact; REQ-029 D-2855: the
  // function snapshots that name and role onto the version, and the
  // register's "by whom" reads the snapshot.
  if (!facts.name?.trim())
    return {
      ok: false,
      message: ADOPT_NEEDS_NAME,
      href: detailsHref(set.id),
      hrefLabel: ADOPT_NEEDS_NAME_LINK,
    };

  // The policy review register exists from the first adoption on (REQ-009
  // FR-7). Its rows are written with the admin client (D-1706): the table's
  // insert and update policies need an active subscription, and a provider
  // adopting a pack they have only bought has none, so the owner's session
  // would seed nothing and date nothing, without an error. The set is
  // proven to be the account's above, and the writes carry its id.
  const admin = createSupabaseAdminClient();
  await seedPolicyReviews(admin, accountId);
  // REQ-029 D-2854: the approval date is never a fact; it is the version's
  // `adopted_on`, written in Sydney by `adopt_document_version`.

  // QA pass F1 (17 Oct 2026, D-2269): the set must be the account's newest
  // ready set, the rule `adopt_document_version` holds, said here in plain
  // words before anything is written; the adopt step's page may be open while
  // a regeneration finishes.
  const newest = await latestReadySet(supabase, accountId);
  if (newest.setId !== set.id) return { ok: false, message: NOT_CURRENT_PACK };

  // REQ-024 A0 (D-2433, D-2441): re-render first, so the version adopted is
  // the one that carries the approval date; then adopt the newest version of
  // each document in the group through the function; then refresh the zip's
  // summary and Start here sheet, which read adoption per version.
  // D-2448 and D-2449 (#77's signed-in run): this re-render also writes the
  // adoption dates into the control tables of groups adopted earlier, a new
  // version of each with the same words, so their adoption is carried onto
  // that version here, with the earlier version's own day, rather than left
  // as a "new version to adopt" the owner never asked for; a facts edit on
  // the Finish page still leaves the nudge.
  // QA pass F1 and N6 (D-2269): the adoption comes first and its result is
  // read, as `adoptDocumentVersionAction` reads it; the checklist and the
  // circulation rows are written only once every document of the group is
  // adopted, so a refusal or a throw in the re-render leaves nothing ticked.
  // REQ-029 D-2855: no re-render before the adoption; the stored model is
  // the template, and the snapshot fills it at read time.
  const adoptedBefore = await listAdoptedDates(admin, accountId);
  const own = new Set(group.documents.map((d) => d.document_type_id));
  const notAdopted: string[] = [];
  for (const d of await listLatestDocuments(admin, set.id)) {
    const earlier = adoptedBefore.get(d.document_type_id);
    if (own.has(d.document_type_id)) {
      const day = await markAdopted(
        admin,
        accountId,
        d.document_type_id,
        set.id,
      );
      if (!day) notAdopted.push(d.document_type_id);
    } else if (earlier && !d.adopted_on)
      await markAdopted(admin, accountId, d.document_type_id, set.id, earlier);
  }
  if (notAdopted.length > 0) {
    log.warn("path.adopt.group.not-adopted", {
      accountId,
      versionSetId: set.id,
      group: parsed.data.group,
      documents: notAdopted.length,
    });
    return { ok: false, message: NOT_CURRENT_PACK };
  }
  await refreshSetSummary(admin, set.id);

  // Checklist Done for each document in the group (REQ-006 items keyed by document type).
  const { answers, result } = await loadQuestionnaire();
  const items =
    answers && result
      ? deriveChecklist(
          result,
          answers,
          getStandardsDataset(),
          checklistPeriod(
            await currentPeriod(supabase, accountId),
            // REQ-023 FR-4 (Session D): the change-of-ownership item reads the changes register.
            await latestOwnershipChangeOn(supabase, accountId),
          ),
        ).items
      : [];
  for (const d of group.documents) {
    const item = items.find((i) => i.documentTypeId === d.document_type_id);
    if (item) {
      const up = await supabase
        .from("checklist_items")
        .upsert(
          { account_id: accountId, item_id: item.id, status: "have", note: "" },
          { onConflict: "account_id,item_id" },
        );
      if (up.error)
        log.warn("path.adopt.checklist-failed", {
          accountId,
          code: up.error.code,
        });
    }
  }
  // REQ-018 FR-14: the circulation record, one row per document in the group (append only; codes only).
  const circulation = parsed.data.circulation;
  if (circulation) {
    const rows = group.documents.map((d) => ({
      account_id: accountId,
      document_type_id: d.document_type_id,
      circulated_on: circulation.circulated_on,
      worker_refs: circulation.worker_refs,
      how: circulation.how ?? "",
    }));
    const ins = await supabase.from("policy_circulations").insert(rows);
    if (ins.error)
      log.warn("path.adopt.circulation-failed", {
        accountId,
        code: ins.error.code,
      });
  }
  log.info("path.adopt.group", {
    accountId,
    versionSetId: set.id,
    group: parsed.data.group,
    documents: group.documents.length,
  });
  // REQ-029 D-2855: no version moved; the gate above proved no blank is open.
  return { ok: true, changed: 0, blanksLeft: 0 };
}

const ReadoptInput = strictObject({
  setId: z.string().uuid(),
  typeId: z.string().regex(/^[a-z0-9-]{1,80}$/),
});

/**
 * REQ-024 A0 (D-2427, D-2436): the document page's "Adopt this version"
 * for a type whose newest version is unadopted while an older one was
 * adopted (a facts edit or a regeneration wrote it). The function refuses a
 * version that is not the latest of its type in the account's newest ready
 * set, so the page offers the action on that set alone.
 */
export async function adoptDocumentVersionAction(
  input: unknown,
): Promise<PathActionResult> {
  const parsed = parseInput(ReadoptInput, input);
  if (!parsed.ok) return { ok: false, message: "That document was not found." };
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted)
    return { ok: false, message: "Sign in to adopt your documents." };
  const supabase = await createSupabaseServerClient();
  const set = await getVersionSet(supabase, parsed.data.setId);
  if (!set || set.account_id !== viewer.account.id || set.status !== "ready")
    return { ok: false, message: "That document was not found." };
  const facts = await loadFacts(supabase, viewer.account.id);
  if (!facts.name?.trim())
    return {
      ok: false,
      message: ADOPT_NEEDS_NAME,
      href: detailsHref(set.id),
      hrefLabel: ADOPT_NEEDS_NAME_LINK,
    };
  const admin = createSupabaseAdminClient();
  const adopted = await markAdopted(
    admin,
    viewer.account.id,
    parsed.data.typeId,
    set.id,
  );
  if (!adopted)
    return {
      ok: false,
      message:
        "This version could not be adopted. It must be the newest version in your current pack.",
    };
  await refreshSetSummary(admin, set.id);
  log.info("path.adopt.version", {
    accountId: viewer.account.id,
    versionSetId: set.id,
    documentTypeId: parsed.data.typeId,
  });
  return { ok: true };
}
