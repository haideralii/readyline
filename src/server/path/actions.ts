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
import { deriveChecklist } from "@/lib/checklist/derive";
import { groupSlug, orderDocuments } from "@/lib/generator/set-order";
import { log } from "@/lib/logging/logger";
import { parseInput, strictObject } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import {
  getVersionSet,
  listLatestDocuments,
} from "@/server/generation/queries";
import { rerenderSetWithFacts } from "@/server/generation/rerender";
import { markAdopted, seedPolicyReviews } from "@/server/registers/seed";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { loadFacts, saveFact } from "./facts";
import { loadQuestionnaire } from "./state";

export type PathActionResult =
  | { ok: true; blanksLeft?: number; changed?: number }
  | { ok: false; message: string };

const FactInput = strictObject({
  key: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/),
  value: z.string().trim().min(1).max(200),
});

export async function saveFactAction(
  input: unknown,
): Promise<PathActionResult> {
  const parsed = parseInput(FactInput, input);
  if (!parsed.ok)
    return {
      ok: false,
      message: "A few words are enough; up to 200 characters.",
    };
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
    return {
      ok: false,
      message: "We could not save that just now. Try again.",
    };
  }
  return { ok: true };
}

const SetInput = strictObject({ setId: z.string().uuid() });

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
  const out = await rerenderSetWithFacts({
    admin: createSupabaseAdminClient(),
    set,
    facts,
  });
  return { ok: true, changed: out.changed, blanksLeft: out.blanksLeft };
}

const GroupInput = strictObject({
  setId: z.string().uuid(),
  group: z.string().regex(/^[a-z][a-z0-9-]{0,40}$/),
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

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const todayWords = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  // The policy review register exists from the first adoption on (REQ-009 FR-7).
  await seedPolicyReviews(supabase, accountId);
  const facts = await loadFacts(supabase, accountId);
  if (!facts.date) {
    const r = await saveFact(supabase, accountId, "date", todayWords);
    if (r.ok) facts.date = todayWords;
  }

  // Checklist Done for each document in the group (REQ-006 items keyed by document type).
  const { answers, result } = await loadQuestionnaire();
  const items =
    answers && result
      ? deriveChecklist(result, answers, getStandardsDataset()).items
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
    await markAdopted(supabase, accountId, d.document_type_id, today);
  }
  const out = await rerenderSetWithFacts({
    admin: createSupabaseAdminClient(),
    set,
    facts,
  });
  log.info("path.adopt.group", {
    accountId,
    versionSetId: set.id,
    group: parsed.data.group,
    documents: group.documents.length,
  });
  return { ok: true, changed: out.changed, blanksLeft: out.blanksLeft };
}
