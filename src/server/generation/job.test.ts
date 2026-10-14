// @vitest-environment node
/**
 * The paid generation job (REQ-007 FR-5, D-706) over an in-memory backend
 * and store, a fake model and a fake clock: a whole set in one tick, the
 * same set across several budgeted ticks with nothing generated twice,
 * retries that end in a failed job, and a refund that cancels the job.
 */
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import { documentTypeById } from "@/lib/generator/catalogue";
import { FakeClient, ReplayClient } from "@/lib/generator/model-client";
import { loadReferenceCases } from "@/lib/generator/reference-cases";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { LogOnlyEmailProvider } from "@/server/email/provider";
import {
  MAX_ATTEMPTS,
  runGenerationTick,
  runGenerationTicks,
  type GenerationJobRow,
  type JobBackend,
  type JobContext,
  type JobPatch,
} from "./job";
import { SELF_ASSESSMENT_ID } from "./run";
import type {
  DocumentVersionRow,
  GenerationLogRow,
  GenerationStore,
  VersionSetRow,
} from "./store";

vi.mock("server-only", () => ({}));

const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const OWNER = "22222222-2222-4222-8222-222222222222";
const dataset = getStandardsDataset();
const soleTrader = loadReferenceCases().find(
  (c) => c.id === "verification-sole-trader",
)!;

class MemoryStore implements GenerationStore {
  sets: VersionSetRow[] = [];
  documents: DocumentVersionRow[] = [];
  logs: GenerationLogRow[] = [];
  objects = new Map<string, { bytes: Uint8Array; contentType: string }>();
  failPut = false;
  private n = 0;
  private id() {
    this.n++;
    return `${this.n.toString(16).padStart(8, "0")}-0000-4000-8000-000000000000`;
  }
  async createVersionSet(input: {
    accountId: string;
    createdBy: string;
    answersHash: string;
    result: VersionSetRow["derived_result"];
  }) {
    const row: VersionSetRow = {
      id: this.id(),
      account_id: input.accountId,
      created_by: input.createdBy,
      answers_snapshot_hash: input.answersHash,
      derived_result: input.result,
      status: "generating",
      document_count: 0,
      fallback_section_count: 0,
      generated_count: 0,
      storage_prefix: "",
      created_at: new Date().toISOString(),
      completed_at: null,
    };
    this.sets.push(row);
    return row;
  }
  async finishVersionSet(
    id: string,
    counts: {
      documents: number;
      fallbackSections: number;
      generated: number;
      providerInputSections?: number;
      status: "ready" | "failed";
    },
  ) {
    const row = this.sets.find((s) => s.id === id)!;
    Object.assign(row, {
      status: counts.status,
      document_count: counts.documents,
      fallback_section_count: counts.fallbackSections,
      generated_count: counts.generated,
      provider_input_section_count: counts.providerInputSections ?? 0,
    });
  }
  async insertDocumentVersion(
    input: Omit<DocumentVersionRow, "id" | "created_at">,
  ) {
    const row = {
      ...input,
      id: this.id(),
      created_at: new Date().toISOString(),
    };
    this.documents.push(row);
    return row;
  }
  async insertLog(rows: GenerationLogRow[]) {
    this.logs.push(...rows);
  }
  async putObject(path: string, bytes: Uint8Array, contentType: string) {
    if (this.failPut) throw new Error("storage down");
    this.objects.set(path, { bytes, contentType });
  }
  async getObject(path: string) {
    const o = this.objects.get(path);
    if (!o) throw new Error(`no object at ${path}`);
    return o.bytes;
  }
}

class MemoryBackend implements JobBackend {
  jobs: GenerationJobRow[] = [];
  entitlementVersionSets = new Map<string, string>();
  audits: string[] = [];
  quotaHits = 0;
  revoked = false;
  contextError: string | null = null;
  constructor(private readonly store: MemoryStore) {}
  enqueue(): GenerationJobRow {
    const job: GenerationJobRow = {
      id: `job-${this.jobs.length + 1}`,
      account_id: ACCOUNT,
      purchase_id: "purchase-1",
      entitlement_id: "ent-1",
      assessment_id: "1:hash",
      status: "queued",
      attempts: 0,
      next_document_index: 0,
      version_set_id: null,
      progress: {},
      last_error: null,
      next_run_at: "2026-10-12T00:00:00.000Z",
      created_at: "2026-10-12T00:00:00.000Z",
      updated_at: "2026-10-12T00:00:00.000Z",
    };
    this.jobs.push(job);
    return job;
  }
  async claim() {
    const job = this.jobs.find(
      (j) =>
        (j.status === "queued" || j.status === "running") &&
        j.next_run_at <= "2026-10-12T00:00:00.000Z",
    );
    if (!job) return null;
    job.status = "running";
    job.next_run_at = "2026-10-12T01:00:00.000Z";
    return structuredClone(job);
  }
  async update(id: string, patch: JobPatch) {
    Object.assign(
      this.jobs.find((j) => j.id === id)!,
      structuredClone(patch),
    );
  }
  async loadContext(): Promise<JobContext | { error: string }> {
    if (this.contextError) return { error: this.contextError };
    return {
      answers: soleTrader.answers,
      tradingName: soleTrader.answers.business.tradingName,
      ownerUserId: OWNER,
      ownerEmail: "owner@example.test",
      entitlementRevoked: this.revoked,
      assessmentMatches: true,
    };
  }
  async listDocuments(versionSetId: string) {
    return this.store.documents.filter(
      (d) => d.version_set_id === versionSetId,
    );
  }
  async setEntitlementVersionSet(entitlementId: string, versionSetId: string) {
    this.entitlementVersionSets.set(entitlementId, versionSetId);
  }
  async quotaHit() {
    this.quotaHits++;
    return true;
  }
  async audit(_accountId: string, versionSetId: string) {
    this.audits.push(versionSetId);
  }
}

/** Answers every section with a short, lint-clean paragraph naming the provider. */
class EchoClient extends FakeClient {
  calls = 0;
  constructor(private readonly name: string) {
    super([]);
  }
  async complete(request: Parameters<FakeClient["complete"]>[0]) {
    this.calls++;
    const id =
      request.user.match(/section id: ([a-z0-9-]+)\)/)?.[1] ?? "purpose";
    return {
      text: JSON.stringify({
        sectionId: id,
        usedFacts: ["tradingName", "states"],
        blocks: [
          {
            type: "paragraph",
            text: `${this.name} sets this out in plain words for every worker.`,
          },
        ],
      }),
      usage: { inputTokens: 100, outputTokens: 50 },
      stopReason: "end_turn" as const,
    };
  }
}

function harness(opts: { stepMs?: number; budgetMs?: number } = {}) {
  const store = new MemoryStore();
  const backend = new MemoryBackend(store);
  const email = new LogOnlyEmailProvider();
  const client = new EchoClient(soleTrader.answers.business.tradingName);
  let t = 0;
  const now = () => new Date(1_760_000_000_000 + (t += opts.stepMs ?? 0));
  const tick = () =>
    runGenerationTick({
      backend,
      store,
      client,
      modelId: "fake",
      dataset,
      email,
      siteUrl: "https://readyline.example/",
      now,
      budgetMs: opts.budgetMs ?? 10 * 60_000,
    });
  return { store, backend, email, client, tick, now };
}

const expectedTypeIds = [
  ...soleTrader.result.documents.map((d) => d.id),
  SELF_ASSESSMENT_ID,
];

describe("runGenerationTick (REQ-007 FR-5, D-706)", () => {
  it("does nothing when no job is runnable", async () => {
    const h = harness();
    expect(await h.tick()).toEqual({ claimed: false });
  });

  it("generates the whole sole-trader set in one tick: documents, summary, zip, entitlement, audit and email", async () => {
    const h = harness();
    const job = h.backend.enqueue();
    const report = await h.tick();
    expect(report).toMatchObject({
      claimed: true,
      jobId: job.id,
      outcome: "ready",
      documentsDone: expectedTypeIds.length,
      documentsTotal: expectedTypeIds.length,
    });
    expect(h.store.documents.map((d) => d.document_type_id)).toEqual(
      expectedTypeIds,
    );
    expect(h.store.documents.every((d) => d.status === "ready")).toBe(true);
    const set = h.store.sets[0];
    expect(set.status).toBe("ready");
    expect(set.document_count).toBe(expectedTypeIds.length);
    expect(set.created_by).toBe(OWNER);
    const zip = unzipSync(
      h.store.objects.get(`${ACCOUNT}/${set.id}/set.zip`)!.bytes,
    );
    expect(Object.keys(zip).sort()).toEqual(
      [
        ...expectedTypeIds.map((id) => `${id}.docx`),
        "readiness-summary.pdf",
        "README.txt",
      ].sort(),
    );
    expect(strFromU8(zip["README.txt"])).toContain("Sunrise Supports");
    expect(h.backend.entitlementVersionSets.get("ent-1")).toBe(set.id);
    expect(h.backend.audits).toEqual([set.id]);
    expect(h.backend.quotaHits).toBe(1);
    expect(h.backend.jobs[0].status).toBe("ready");
    expect(h.email.sent).toHaveLength(1);
    expect(h.email.sent[0].to).toBe("owner@example.test");
    expect(h.email.sent[0].text).toContain(
      "https://readyline.example/documents",
    );
    expect(h.store.logs.length).toBe(h.client.calls);
  });

  it("stops when the budget is spent and the next ticks carry on without generating any section twice", async () => {
    // Every clock read advances 100 ms; a 250 ms budget allows about two sections per tick.
    const h = harness({ stepMs: 100, budgetMs: 250 });
    h.backend.enqueue();
    const outcomes: string[] = [];
    for (let i = 0; i < 400; i++) {
      const r = await h.tick();
      if (!r.claimed) throw new Error("job lost");
      outcomes.push(r.outcome);
      if (r.outcome === "ready") break;
      expect(r.outcome).toBe("more");
      // Hand-back persists the index and the in-flight sections.
      const job = h.backend.jobs[0];
      expect(job.status).toBe("queued");
      expect(job.next_document_index).toBeLessThanOrEqual(
        expectedTypeIds.length,
      );
      job.next_run_at = "2026-10-12T00:00:00.000Z";
    }
    expect(outcomes.at(-1)).toBe("ready");
    expect(outcomes.length).toBeGreaterThan(3);
    expect(h.store.documents.map((d) => d.document_type_id)).toEqual(
      expectedTypeIds,
    );
    // One model call per tailored section across the whole run: the same as a single tick.
    const single = harness();
    single.backend.enqueue();
    await single.tick();
    expect(h.client.calls).toBe(single.client.calls);
    expect(h.store.logs.length).toBe(h.client.calls);
    expect(h.backend.jobs[0].attempts).toBe(0);
    expect(h.email.sent).toHaveLength(1);
  });

  it("retries a failing tick with backoff and gives up after the third attempt with an operator alert", async () => {
    const h = harness();
    h.backend.enqueue();
    h.store.failPut = true;
    const first = await h.tick();
    expect(first).toMatchObject({ claimed: true, outcome: "retry" });
    const job = h.backend.jobs[0];
    expect(job.status).toBe("queued");
    expect(job.attempts).toBe(1);
    expect(job.last_error).toBe("storage down");
    // Backoff: at least two minutes after the harness clock's "now".
    expect(
      new Date(job.next_run_at).getTime() - 1_760_000_000_000,
    ).toBeGreaterThanOrEqual(2 * 60_000);
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      job.next_run_at = "2026-10-12T00:00:00.000Z";
      await h.tick();
    }
    expect(job.status).toBe("failed");
    expect(job.attempts).toBe(MAX_ATTEMPTS);
    expect(h.store.sets[0].status).toBe("failed");
    expect(h.email.sent).toHaveLength(0);
    // A failed job is not claimable again.
    expect(await h.tick()).toEqual({ claimed: false });
  });

  it("cancels a job whose entitlement was revoked before it ran, generating nothing", async () => {
    const h = harness();
    h.backend.enqueue();
    h.backend.revoked = true;
    const r = await h.tick();
    expect(r).toMatchObject({ claimed: true, outcome: "failed" });
    expect(h.backend.jobs[0].last_error).toMatch(/revoked/);
    expect(h.store.sets).toHaveLength(0);
    expect(h.client.calls).toBe(0);
  });

  it("replays the recorded sole-trader fixtures through the job with every section generated (no model call)", async () => {
    const store = new MemoryStore();
    const backend = new MemoryBackend(store);
    backend.enqueue();
    const report = await runGenerationTick({
      backend,
      store,
      client: new ReplayClient(),
      modelId: "claude-sonnet-5-5",
      dataset,
      email: new LogOnlyEmailProvider(),
      siteUrl: "https://readyline.example",
    });
    expect(report).toMatchObject({ claimed: true, outcome: "ready" });
    // REQ-016 S-4: the five participant-facing documents gained an unrecorded
    // plain-language summary; it ships as marked generic text until the next
    // recording session (D-542). Every recorded section still generates.
    const notGenerated = store.logs.filter((l) => l.status !== "generated");
    expect(new Set(notGenerated.map((l) => l.section_id))).toEqual(
      new Set(["plain-language-summary"]),
    );
    const facing = store.documents.filter(
      (d) => documentTypeById(d.document_type_id)?.participantFacing,
    ).length;
    expect(facing).toBeGreaterThan(0);
    expect(notGenerated).toHaveLength(facing);
    expect(store.sets[0].fallback_section_count).toBe(facing);
    expect(store.logs.length).toBeGreaterThan(50);
    // FR-0c: no document ships undrafted, and the provider's blanks are counted apart from failures.
    for (const d of store.documents)
      expect(
        d.model.sections.filter((s) => s.status === "placeholder"),
        d.document_type_id,
      ).toEqual([]);
    expect(store.sets[0].provider_input_section_count).toBeGreaterThan(0);
    expect(report.claimed && report.failures?.length).toBe(facing);
    expect(
      report.claimed &&
        report.failures?.every((f) => f.kind === "fixture-missing"),
    ).toBe(true);
  });

  it("runGenerationTicks takes the next runnable job within the budget and reports when more remains", async () => {
    const h = harness();
    h.backend.enqueue();
    h.backend.enqueue();
    const out = await runGenerationTicks({
      backend: h.backend,
      store: h.store,
      client: h.client,
      modelId: "fake",
      dataset,
      email: h.email,
      siteUrl: "https://readyline.example",
      now: h.now,
      budgetMs: 10 * 60_000,
    });
    expect(out.more).toBe(false);
    expect(out.reports.map((r) => (r.claimed ? r.outcome : "none"))).toEqual([
      "ready",
      "ready",
      "none",
    ]);
    expect(h.store.sets).toHaveLength(2);
  });
});

/** Every section call costs a fixed time on a clock the test owns (batch 32 item 2). */
function slowHarness(sectionMs: number, budgetMs: number) {
  const store = new MemoryStore();
  const backend = new MemoryBackend(store);
  const email = new LogOnlyEmailProvider();
  let t = 1_760_000_000_000;
  const now = () => new Date(t);
  class SlowClient extends EchoClient {
    async complete(request: Parameters<FakeClient["complete"]>[0]) {
      t += sectionMs;
      return super.complete(request);
    }
  }
  const client = new SlowClient(soleTrader.answers.business.tradingName);
  const tick = () =>
    runGenerationTick({
      backend,
      store,
      client,
      modelId: "fake",
      dataset,
      email,
      siteUrl: "https://readyline.example/",
      now,
      budgetMs,
    });
  return { store, backend, client, tick, elapsed: () => t - 1_760_000_000_000 };
}

describe("budget loop (batch 32 item 2, D-1006)", () => {
  it("starts a document only when the last one's duration, with half again, still fits the budget", async () => {
    // Sections cost 5 s; the budget is 40 s. The tick drafts whole documents
    // and hands back before the budget is spent, not after.
    const h = slowHarness(5_000, 40_000);
    h.backend.enqueue();
    const r = await h.tick();
    if (!r.claimed) throw new Error("job lost");
    expect(r.outcome).toBe("more");
    expect(r.documentsDone).toBeGreaterThanOrEqual(1);
    expect(r.documentsDone).toBeLessThan(expectedTypeIds.length);
    // Handed back by the fit rule: time remained, but not enough for another document of the last size.
    expect(h.elapsed()).toBeLessThan(40_000);
    expect(h.store.documents).toHaveLength(r.documentsDone);
    expect(h.backend.jobs[0].next_document_index).toBe(r.documentsDone);
    expect(h.backend.jobs[0].status).toBe("queued");
  });

  it("the same rule guards each section: a 30-second section in a 40-second budget runs once, then hands back", async () => {
    const h = slowHarness(30_000, 40_000);
    h.backend.enqueue();
    const r = await h.tick();
    if (!r.claimed) throw new Error("job lost");
    expect(r.outcome).toBe("more");
    expect(r.sectionsGenerated).toBe(1);
    expect(h.elapsed()).toBe(30_000);
  });

  it("a run that overlaps a live chain claims nothing and reports no more work (the kicker's no-op)", async () => {
    const h = harness();
    h.backend.enqueue();
    // Another invocation holds the lease.
    const held = await h.backend.claim();
    expect(held?.status).toBe("running");
    const out = await runGenerationTicks({
      backend: h.backend,
      store: h.store,
      client: h.client,
      modelId: "fake",
      dataset,
      email: h.email,
      siteUrl: "https://readyline.example",
      now: h.now,
      budgetMs: 10 * 60_000,
    });
    expect(out).toEqual({ reports: [{ claimed: false }], more: false });
    expect(h.client.calls).toBe(0);
  });
});
