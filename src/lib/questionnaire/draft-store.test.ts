import { describe, expect, it } from "vitest";
import {
  DRAFT_STORAGE_KEY,
  DraftStorageUnavailableError,
  createLocalDraftStore,
} from "./draft-store";
import type { QuestionnaireDraft } from "./schema";

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const draft: QuestionnaireDraft = {
  answersVersion: 1,
  answers: {
    business: {
      tradingName: "Sunrise",
      structure: "sole-trader",
      states: ["NSW"],
    },
  },
  currentStep: "supports",
  updatedAt: "2026-10-11T10:00:00.000Z",
};

describe("local DraftStore", () => {
  it("round-trips a draft", async () => {
    const s = fakeStorage();
    const store = createLocalDraftStore(() => s);
    expect(await store.load()).toBeNull();
    await store.save(draft);
    expect(JSON.parse(s.map.get(DRAFT_STORAGE_KEY)!)).toEqual(draft);
    expect(await store.load()).toEqual(draft);
    await store.clear();
    expect(await store.load()).toBeNull();
  });

  it("discards corrupt or foreign-version drafts instead of trusting them", async () => {
    const corrupt = createLocalDraftStore(() =>
      fakeStorage({ [DRAFT_STORAGE_KEY]: "{not json" }),
    );
    expect(await corrupt.load()).toBeNull();
    const foreign = createLocalDraftStore(() =>
      fakeStorage({
        [DRAFT_STORAGE_KEY]: JSON.stringify({ ...draft, answersVersion: 99 }),
      }),
    );
    expect(await foreign.load()).toBeNull();
    const injected = createLocalDraftStore(() =>
      fakeStorage({
        [DRAFT_STORAGE_KEY]: JSON.stringify({ ...draft, isAdmin: true }),
      }),
    );
    expect(await injected.load()).toBeNull();
  });

  it("reports unavailable storage with a typed error (AC-7 storage-throws path)", async () => {
    const throwing = createLocalDraftStore(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    await expect(throwing.load()).rejects.toBeInstanceOf(
      DraftStorageUnavailableError,
    );
    await expect(throwing.save(draft)).rejects.toBeInstanceOf(
      DraftStorageUnavailableError,
    );
    const quota = createLocalDraftStore(() => ({
      getItem: () => null,
      setItem: () => {
        throw new DOMException("quota", "QuotaExceededError");
      },
      removeItem: () => undefined,
    }));
    await expect(quota.save(draft)).rejects.toBeInstanceOf(
      DraftStorageUnavailableError,
    );
  });

  it("treats a missing storage (server render) as empty", async () => {
    const store = createLocalDraftStore(() => undefined);
    expect(await store.load()).toBeNull();
    await expect(store.save(draft)).resolves.toBeUndefined();
  });
});
