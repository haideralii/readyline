/**
 * DraftStore backed by the signed-in owner's account (REQ-004 FR-2; REQ-003
 * FR-3 "storage change only"). Calls the server actions; row-level security
 * scopes every read and write to the user's own account.
 */
import type { DraftStore } from "@/lib/questionnaire/draft-store";
import {
  clearServerDraft,
  loadServerDraft,
  saveServerDraft,
} from "@/server/accounts/actions";

export function createServerDraftStore(): DraftStore {
  return {
    load: () => loadServerDraft(),
    async save(draft) {
      const r = await saveServerDraft(draft);
      if (!r.ok) throw new Error("Could not save the draft to your account");
    },
    async clear() {
      await clearServerDraft();
    },
  };
}
