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
// The fixture replays render whole sets; under the full suite's load they pass five seconds.
vi.setConfig({ testTimeout: 60_000 });

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
  /** REQ-017 AC-2: facts given on an earlier pack. */
  facts: Record<string, string> = {};
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
      facts: this.facts,
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
  }, 60_000);
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

describe("account facts fill a later pack (REQ-017 FR-2, AC-2)", () => {
  it("every blank the facts answer is filled before the document is rendered and stored", async () => {
    const store = new MemoryStore();
    const backend = new MemoryBackend(store);
    backend.facts = {
      name: "Jane Citizen",
      role: "Owner",
      date: "14 October 2026",
      "phone-or-email": "0400 000 000",
    };
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
    const governance = store.documents.find(
      (d) => d.document_type_id === "governance-policy",
    )!;
    const text = JSON.stringify(governance.model);
    expect(text).toContain("Jane Citizen, Owner");
    expect(text).not.toMatch(/\[name\]|\[role\]|\[date\]/);
    // The stored .docx carries the filled text too.
    const docx = store.objects.get(governance.storage_path)!;
    const xml = strFromU8(unzipSync(docx.bytes)["word/document.xml"]);
    expect(xml).toContain("Jane Citizen");
    expect(store.sets[0].provider_input_section_count).toBeLessThan(
      governance.model.sections.length * store.documents.length,
    );
  }, 60_000);
});

/** REQ-021 (D-2101): the job row carries what the writing indicator shows, and a document that keeps failing waits for the owner (S4). */
describe("the writing indicator's fields and the attention state (REQ-021)", () => {
  it("records the phase, the document and section in flight, the set size and the time of every progress write", async () => {
    const h = harness({ stepMs: 10 });
    const job = h.backend.enqueue();
    const seen: {
      phase?: string;
      section?: number;
      count?: number;
      doc?: string | null;
    }[] = [];
    const update = h.backend.update.bind(h.backend);
    h.backend.update = async (id, patch) => {
      if (patch.phase || patch.current_section_index !== undefined)
        seen.push({
          phase: patch.phase,
          section: patch.current_section_index,
          count: patch.section_count,
          doc: patch.current_document_type_id,
        });
      if (patch.phase && !patch.last_progress_at)
        throw new Error("a phase write without last_progress_at");
      return update(id, patch);
    };
    const report = await h.tick();
    expect(report).toMatchObject({ claimed: true, outcome: "ready" });
    const row = h.backend.jobs[0];
    expect(row.phase).toBe("ready");
    expect(row.document_total).toBe(expectedTypeIds.length);
    expect(row.failed_documents).toEqual([]);
    expect(typeof row.last_progress_at).toBe("string");
    const phases = seen.map((s) => s.phase).filter(Boolean);
    expect(phases[0]).toBe("preparing");
    expect(phases).toContain("writing");
    expect(phases).toContain("checking");
    expect(phases).toContain("assembling");
    expect(phases.at(-1)).toBe("ready");
    // Section index is 1-based and never above the document's tailored count.
    const writing = seen.filter((s) => s.phase === "writing" && s.count);
    expect(writing.length).toBeGreaterThan(0);
    for (const w of writing) {
      expect(w.section).toBeGreaterThanOrEqual(1);
      expect(w.section).toBeLessThanOrEqual(w.count!);
    }
    expect(seen.some((s) => s.doc === expectedTypeIds[0])).toBe(true);
    expect(job.id).toBe(row.id);
  });

  it("a document the model cannot draft is redrafted once, then listed as needing another go (degraded, still stored) and the job waits for the owner (S4)", async () => {
    const h = harness();
    h.backend.enqueue();
    const broken = expectedTypeIds[2];
    const complete = h.client.complete.bind(h.client);
    // The user prompt names the document by its title: Document: "<title>" (<kind>).
    const marker = `Document: "${documentTypeById(broken)!.title}"`;
    h.client.complete = async (request) => {
      if (request.user.includes(marker))
        throw new Error("model refused this document");
      return complete(request);
    };
    // Every section falls back, so the document is redrafted once (REQ-016 FR-0b): a hand-back.
    const first = await h.tick();
    expect(first).toMatchObject({ claimed: true, outcome: "more" });
    h.backend.jobs[0].next_run_at = "2026-10-12T00:00:00.000Z";
    const second = await h.tick();
    expect(second).toMatchObject({
      claimed: true,
      outcome: "attention",
      documentsDone: expectedTypeIds.length - 1,
      documentsTotal: expectedTypeIds.length,
    });
    const row = h.backend.jobs[0];
    expect(row.status).toBe("attention");
    expect(row.phase).toBe("attention");
    expect(row.failed_documents).toMatchObject([
      { typeId: broken, kind: "degraded" },
    ]);
    // The weak document is stored (nothing is lost); the rest are written once each.
    expect(h.store.documents.map((d) => d.document_type_id)).toEqual(
      expectedTypeIds,
    );
    // Not ready: no set finished, no email, the entitlement not handed over.
    expect(h.store.sets[0].status).toBe("generating");
    expect(h.email.sent).toHaveLength(0);
    expect(h.backend.entitlementVersionSets.size).toBe(0);
    // An attention job is not claimable.
    expect(await h.tick()).toEqual({ claimed: false });

    // The owner tries again: only that document is regenerated (a new version), and the set finishes.
    h.client.complete = complete;
    const callsBefore = h.client.calls;
    const progress = row.progress as { redrafts?: Record<string, number> };
    Object.assign(row, {
      status: "queued",
      next_run_at: "2026-10-12T00:00:00.000Z",
      next_document_index: 0,
      failed_documents: [],
      progress: {
        redrafts: { ...progress.redrafts, [broken]: 0 },
        retry: [broken],
      },
    });
    const third = await h.tick();
    expect(third).toMatchObject({ claimed: true, outcome: "ready" });
    const versions = h.store.documents.filter(
      (d) => d.document_type_id === broken,
    );
    expect(versions.map((v) => v.version)).toEqual([1, 2]);
    expect(versions[1].status).toBe("ready");
    const tailoredInBroken = h.store.logs.filter(
      (l) => l.document_type_id === broken && l.status === "generated",
    ).length;
    expect(h.client.calls - callsBefore).toBe(tailoredInBroken);
    expect(h.backend.jobs[0].status).toBe("ready");
    expect(h.email.sent).toHaveLength(1);
  });

  it("a document whose write throws twice is recorded as an error, nothing stored for it, and the owner can continue without it", async () => {
    const h = harness();
    h.backend.enqueue();
    const broken = expectedTypeIds[1];
    const update = h.backend.update.bind(h.backend);
    let throws = 0;
    h.backend.update = async (id, patch) => {
      // The first progress write of the broken document fails, twice (two ticks).
      if (
        patch.current_document_type_id === broken &&
        patch.phase === "writing" &&
        throws < 2
      ) {
        throws += 1;
        throw new Error("boom");
      }
      return update(id, patch);
    };
    const first = await h.tick();
    // The first time is a tick-level retry with backoff, as for any transient error.
    expect(first).toMatchObject({ claimed: true, outcome: "retry" });
    expect(h.backend.jobs[0].attempts).toBe(1);
    h.backend.jobs[0].next_run_at = "2026-10-12T00:00:00.000Z";
    const second = await h.tick();
    expect(second).toMatchObject({ claimed: true, outcome: "attention" });
    const row = h.backend.jobs[0];
    expect(row.failed_documents).toEqual([
      { typeId: broken, kind: "error", detail: "boom" },
    ]);
    expect(h.store.documents.map((d) => d.document_type_id)).toEqual(
      expectedTypeIds.filter((t) => t !== broken),
    );
    // Continue without it: the set finishes with the rest.
    Object.assign(row, {
      status: "queued",
      next_run_at: "2026-10-12T00:00:00.000Z",
      failed_documents: [],
    });
    const done = await h.tick();
    expect(done).toMatchObject({ claimed: true, outcome: "ready" });
    expect(h.store.sets[0].status).toBe("ready");
    expect(h.store.sets[0].document_count).toBe(expectedTypeIds.length - 1);
    expect(h.store.documents.map((d) => d.document_type_id)).toEqual(
      expectedTypeIds.filter((t) => t !== broken),
    );
  });
});
