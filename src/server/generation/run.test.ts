/**
 * The whole pipeline with a fake model and an in-memory store (REQ-005 AC-1,
 * AC-2, AC-3, AC-5, AC-6, SR-5). No network, no database.
 */
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";

// Whole-set runs render dozens of documents through every gate; give them room.
vi.setConfig({ testTimeout: 60_000 });
import { FakeClient } from "@/lib/generator/model-client";
import { loadReferenceCases } from "@/lib/generator/reference-cases";
import { getStandardsDataset } from "@/lib/standards/dataset";
import {
  answersHash,
  generateDocumentSet,
  regenerateSection,
  SELF_ASSESSMENT_ID,
} from "./run";
import type {
  DocumentVersionRow,
  GenerationLogRow,
  GenerationStore,
  VersionSetRow,
} from "./store";

const dataset = getStandardsDataset();
const cases = loadReferenceCases();
const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const USER = "44444444-4444-4444-8444-444444444444";

class MemoryStore implements GenerationStore {
  sets: VersionSetRow[] = [];
  documents: DocumentVersionRow[] = [];
  logs: GenerationLogRow[] = [];
  objects = new Map<string, { bytes: Uint8Array; contentType: string }>();
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
    row.storage_prefix = `${row.account_id}/${row.id}`;
    this.sets.push(row);
    return row;
  }
  async finishVersionSet(
    id: string,
    counts: {
      documents: number;
      fallbackSections: number;
      generated: number;
      status: "ready" | "failed";
    },
  ) {
    const row = this.sets.find((s) => s.id === id)!;
    Object.assign(row, {
      status: counts.status,
      document_count: counts.documents,
      fallback_section_count: counts.fallbackSections,
      generated_count: counts.generated,
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
    this.objects.set(path, { bytes, contentType });
  }
  async getObject(path: string) {
    const o = this.objects.get(path);
    if (!o) throw new Error(`no object at ${path}`);
    return o.bytes;
  }
  /** REQ-024 A2: no register in the reference runs; the Division 3 section renders its empty-register line. */
  async participantRisks(_accountId: string, today: string) {
    return { rows: [], lastReviewedOn: null, takenOn: today };
  }
}

/** A model that answers every section with a short, lint-clean paragraph naming the provider. */
function echoClient(name: string, count: number): FakeClient {
  const replies: string[] = [];
  for (let i = 0; i < count; i++) {
    replies.push(
      JSON.stringify({
        sectionId: "__SECTION__",
        usedFacts: ["tradingName", "states"],
        blocks: [
          {
            type: "paragraph",
            text: `${name} sets this out in plain words for every worker.`,
          },
        ],
      }),
    );
  }
  return new SectionAwareFake(replies);
}

class SectionAwareFake extends FakeClient {
  async complete(request: Parameters<FakeClient["complete"]>[0]) {
    const reply = await super.complete(request);
    const id =
      request.user.match(/section id: ([a-z0-9-]+)\)/)?.[1] ?? "purpose";
    return { ...reply, text: reply.text.replace("__SECTION__", id) };
  }
}

describe("generateDocumentSet", () => {
  it("AC-1: the verification case yields the always set plus the self-assessment, all ready", async () => {
    const c = cases.find((x) => x.id === "verification-sole-trader")!;
    const store = new MemoryStore();
    const out = await generateDocumentSet({
      store,
      client: echoClient(c.answers.business.tradingName, 500),
      modelId: "fake",
      dataset,
      accountId: ACCOUNT,
      userId: USER,
      answers: c.answers,
      result: c.result,
      now: new Date("2026-10-12T00:00:00Z"),
    });
    expect(out.documents.map((d) => d.typeId)).toEqual([
      ...c.result.documents.map((d) => d.id),
      SELF_ASSESSMENT_ID,
    ]);
    expect(
      out.documents.some((d) => d.typeId === "medication-management-procedure"),
    ).toBe(false);
    expect(out.documents.every((d) => d.status === "ready")).toBe(true);
    expect(out.fallbackSections).toBe(0);
    expect(store.sets[0].status).toBe("ready");
    expect(store.sets[0].document_count).toBe(out.documents.length);

    const zip = store.objects.get(`${ACCOUNT}/${store.sets[0].id}/set.zip`)!;
    const files = unzipSync(zip.bytes);
    expect(Object.keys(files)).toContain("governance-policy.docx");
    expect(Object.keys(files)).toContain("readiness-summary.pdf");
    expect(strFromU8(files["README.txt"])).toContain(
      c.answers.business.tradingName,
    );
    expect(
      store.objects.get(`${ACCOUNT}/${store.sets[0].id}/readiness-summary.pdf`)
        ?.contentType,
    ).toBe("application/pdf");
  });

  it("AC-2: the certification case adds the core documents and the self-assessment lists all 24 core standards", async () => {
    const c = cases.find((x) => x.id === "certification-personal-care")!;
    const store = new MemoryStore();
    await generateDocumentSet({
      store,
      client: echoClient(c.answers.business.tradingName, 500),
      modelId: "fake",
      dataset,
      accountId: ACCOUNT,
      userId: USER,
      answers: c.answers,
      result: c.result,
      now: new Date("2026-10-12T00:00:00Z"),
    });
    const ids = store.documents.map((d) => d.document_type_id);
    expect(ids).toContain("medication-management-procedure");
    expect(ids).toContain("mealtime-management-procedure");
    const sa = store.documents.find(
      (d) => d.document_type_id === SELF_ASSESSMENT_ID,
    )!;
    const section = sa.model.sections.find((s) => s.id === "standards-table")!;
    expect(section.status).toBe("fixed");
    const tables = section.blocks.filter((b) => b.type === "table");
    const rows = tables.flatMap((b) => (b.type === "table" ? b.rows : []));
    const coreStandards = dataset.standards.filter(
      (s) => s.moduleId === "core",
    );
    expect(rows.length).toBe(coreStandards.length);
    for (const s of coreStandards) {
      expect(
        rows.some((row) => row[0] === s.name && row[1] === s.outcome),
      ).toBe(true);
    }
    expect(tables.every((b) => b.type === "table" && b.rows.length <= 20)).toBe(
      true,
    );
    expect(sa.model.sections.find((s) => s.id === "how-we-meet")?.mode).toBe(
      "tailored",
    );
    const core = c.result.modules.find((m) => m.id === "core")!;
    expect(core.standardCount).toBe(24);
  });

  it("AC-3 and SR-5: two providers never share a tailored section and logs hold counts only", async () => {
    const [a, b] = cases;
    const sa = new MemoryStore();
    const sb = new MemoryStore();
    await generateDocumentSet({
      store: sa,
      client: echoClient(a.answers.business.tradingName, 500),
      modelId: "fake",
      dataset,
      accountId: ACCOUNT,
      userId: USER,
      answers: a.answers,
      result: a.result,
      now: new Date(),
    });
    await generateDocumentSet({
      store: sb,
      client: echoClient(b.answers.business.tradingName, 500),
      modelId: "fake",
      dataset,
      accountId: ACCOUNT,
      userId: USER,
      answers: b.answers,
      result: b.result,
      now: new Date(),
    });
    const ga = sa.documents.find(
      (d) => d.document_type_id === "governance-policy",
    )!.model;
    const gb = sb.documents.find(
      (d) => d.document_type_id === "governance-policy",
    )!.model;
    for (const s of ga.sections.filter((s) => s.mode === "tailored")) {
      const other = gb.sections.find((x) => x.id === s.id)!;
      expect(JSON.stringify(s.blocks)).not.toEqual(
        JSON.stringify(other.blocks),
      );
    }
    expect(sa.logs.length).toBeGreaterThan(10);
    for (const row of sa.logs) {
      expect(Object.keys(row).sort()).toEqual(
        [
          "account_id",
          "attempts",
          "cache_creation_input_tokens",
          "cache_read_input_tokens",
          "document_type_id",
          "failure_detail",
          "failure_kind",
          "input_tokens",
          "model",
          "output_tokens",
          "prompt_version",
          "request_hash",
          "section_id",
          "status",
          "version_set_id",
        ].sort(),
      );
    }
    expect(answersHash(a.answers)).not.toBe(answersHash(b.answers));
    expect(
      answersHash({
        ...a.answers,
        supports: { ...a.answers.supports, servicesNote: "x" },
      }),
    ).toBe(answersHash(a.answers));
  });

  it("AC-5: when the model cannot be reached every tailored section falls back and the set is still rendered", async () => {
    const c = cases[0];
    const store = new MemoryStore();
    const out = await generateDocumentSet({
      store,
      client: new FakeClient([]),
      modelId: "fake",
      dataset,
      accountId: ACCOUNT,
      userId: USER,
      answers: c.answers,
      result: c.result,
      now: new Date(),
    });
    expect(out.generatedSections).toBe(0);
    expect(out.fallbackSections).toBeGreaterThan(0);
    expect(out.documents.every((d) => d.status === "review")).toBe(true);
    expect(
      store.logs.every((l) => l.status === "fallback" && l.attempts === 2),
    ).toBe(true);
    expect(store.sets[0].status).toBe("ready");
  });

  it("AC-6: regenerating one section changes only that section and records a new version", async () => {
    const c = cases[0];
    const store = new MemoryStore();
    await generateDocumentSet({
      store,
      client: echoClient(c.answers.business.tradingName, 500),
      modelId: "fake",
      dataset,
      accountId: ACCOUNT,
      userId: USER,
      answers: c.answers,
      result: c.result,
      now: new Date(),
    });
    const current = store.documents.find(
      (d) => d.document_type_id === "governance-policy",
    )!;
    const client = new SectionAwareFake([
      JSON.stringify({
        sectionId: "__SECTION__",
        usedFacts: ["tradingName"],
        blocks: [
          {
            type: "paragraph",
            text: "A fresh purpose paragraph for the review.",
          },
        ],
      }),
    ]);
    const { next, outcome } = await regenerateSection({
      store,
      client,
      modelId: "fake",
      dataset,
      current,
      result: c.result,
      sectionId: "purpose",
    });
    expect(outcome).toBe("generated");
    expect(next.version).toBe(2);
    expect(next.document_type_id).toBe("governance-policy");
    const before = current.model.sections;
    const after = next.model.sections;
    expect(after.map((s) => s.id)).toEqual(before.map((s) => s.id));
    for (let i = 0; i < before.length; i++) {
      if (before[i].id === "purpose")
        expect(JSON.stringify(after[i].blocks)).not.toEqual(
          JSON.stringify(before[i].blocks),
        );
      else
        expect(JSON.stringify(after[i].blocks)).toEqual(
          JSON.stringify(before[i].blocks),
        );
    }
    expect(store.objects.has(next.storage_path)).toBe(true);
    // REQ-033 Session C AC-C1 (D-2977): the governance policy carries no plain-words summary, so no state.
    expect(next.summary_check_section_id ?? null).toBeNull();
    expect(next.summary_check_on ?? null).toBeNull();

    // A participant-facing document: the re-generated section leaves the summary to check.
    const complaints = store.documents.find(
      (d) => d.document_type_id === "complaints-management-policy-and-register",
    )!;
    const again = await regenerateSection({
      store,
      client: new SectionAwareFake([
        JSON.stringify({
          sectionId: "__SECTION__",
          usedFacts: ["tradingName"],
          blocks: [
            {
              type: "paragraph",
              text: "A fresh purpose paragraph for the complaints policy.",
            },
          ],
        }),
      ]),
      modelId: "fake",
      dataset,
      current: complaints,
      result: c.result,
      sectionId: "purpose",
      today: "2026-10-19",
    });
    expect(again.next.summary_check_section_id).toBe("purpose");
    expect(again.next.summary_check_on).toBe("2026-10-19");
  });
});
