/**
 * Where a questionnaire draft lives (REQ-003 FR-3, SR-4). The interface is the
 * seam REQ-004 swaps for a server implementation; the model it persists is the
 * versioned `QuestionnaireDraft`, nothing derived.
 *
 * The local implementation wraps every storage call in try/catch: private
 * windows, blocked storage and quota errors must never break the
 * questionnaire, only the "saved on this device" note.
 */
import type { QuestionnaireDraft } from "./schema";

export type DraftStore = {
  load(): Promise<QuestionnaireDraft | null>;
  save(draft: QuestionnaireDraft): Promise<void>;
  clear(): Promise<void>;
};

export const DRAFT_STORAGE_KEY = "readyline.questionnaire.draft.v1";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export class DraftStorageUnavailableError extends Error {
  constructor(cause: unknown) {
    super("Draft storage is unavailable on this device");
    this.name = "DraftStorageUnavailableError";
    this.cause = cause;
  }
}

export function createLocalDraftStore(
  getStorage: () => StorageLike | undefined,
): DraftStore {
  const storage = () => {
    try {
      return getStorage();
    } catch (e) {
      throw new DraftStorageUnavailableError(e);
    }
  };
  return {
    async load() {
      let raw: string | null;
      try {
        raw = storage()?.getItem(DRAFT_STORAGE_KEY) ?? null;
      } catch (e) {
        throw new DraftStorageUnavailableError(e);
      }
      if (!raw) return null;
      try {
        // The schema (and zod) load only when there is a draft to check (D-1012).
        const { QuestionnaireDraft } = await import("./schema");
        const parsed = QuestionnaireDraft.safeParse(JSON.parse(raw));
        // An unreadable or older-version draft is discarded rather than trusted.
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    },
    async save(draft) {
      try {
        storage()?.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      } catch (e) {
        throw new DraftStorageUnavailableError(e);
      }
    },
    async clear() {
      try {
        storage()?.removeItem(DRAFT_STORAGE_KEY);
      } catch (e) {
        throw new DraftStorageUnavailableError(e);
      }
    },
  };
}

/** The browser's localStorage, or undefined when there is no window (server render). */
export function browserStorage(): StorageLike | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}
