// @vitest-environment node
/**
 * REQ-034 FR-4, AC-4 (D-2947): the sample model as a PDF: more than one
 * page, the title and every section heading in the text, and on every page
 * the footer the Word file carries, with the page number, read back through
 * pdfjs.
 */
import { describe, expect, it } from "vitest";
import { SAMPLE_FOOTER, sampleModelForFiles } from "@/lib/sample-document";
import { renderDocumentPdf } from "./pdf-document";
import { footerLead } from "./render-docx";

export async function pdfPageTexts(bytes: Uint8Array): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await pdfjs.getDocument({
    data: bytes.slice(),
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0,
  }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const content = await (await pdf.getPage(i)).getTextContent();
    pages.push(
      content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " "),
    );
  }
  return pages;
}

describe("the sample as a PDF (REQ-034 FR-4)", () => {
  it("renders the sample model with the footer and the page number on every page", async () => {
    const model = sampleModelForFiles();
    const bytes = await renderDocumentPdf(model);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const pages = await pdfPageTexts(bytes);
    expect(pages.length).toBeGreaterThan(1);
    const lead = footerLead(model, false);
    expect(lead).toContain(SAMPLE_FOOTER);
    pages.forEach((text, i) => {
      expect(text, `page ${i + 1}`).toContain(SAMPLE_FOOTER);
      expect(text, `page ${i + 1}`).toContain(
        `Page ${i + 1} of ${pages.length}`,
      );
    });
    const all = pages.join(" ");
    expect(all).toContain(model.title);
    for (const s of model.sections) expect(all, s.id).toContain(s.heading);
  }, 30_000);

  it("turns a character outside WinAnsi into a question mark instead of throwing", async () => {
    const model = sampleModelForFiles();
    const odd = {
      ...model,
      title: "Policy \u{1F600} with an emoji",
      sections: model.sections.slice(0, 1),
    };
    const pages = await pdfPageTexts(await renderDocumentPdf(odd));
    expect(pages[0]).toContain("Policy ? with an emoji");
  });
});
