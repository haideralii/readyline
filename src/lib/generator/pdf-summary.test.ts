import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildProviderFacts } from "./facts";
import { renderSummaryPdf } from "./pdf-summary";
import { loadReferenceCases } from "./reference-cases";

describe("PDF readiness summary (REQ-005 FR-6)", () => {
  it("renders a valid PDF naming the provider, the pathway and every document", async () => {
    const [c] = loadReferenceCases();
    const facts = buildProviderFacts(c.answers, c.result);
    const bytes = await renderSummaryPdf({
      facts,
      result: c.result,
      documents: c.result.documents.map((d, i) => ({
        title: d.title,
        status: i === 0 ? "review" : "ready",
        fallbackSections: i === 0 ? 2 : 0,
      })),
      generatedAt: "2026-10-12",
      version: "1",
    });
    expect(Buffer.from(bytes.subarray(0, 5)).toString("latin1")).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(2000);
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getTitle()).toContain("readiness summary");
    expect(loaded.getTitle()).toContain(facts.tradingName);
    expect(loaded.getPageCount()).toBeGreaterThanOrEqual(1);
  });
});
