// @vitest-environment node
/**
 * REQ-033 AC-2, SR-1 (D-2930): the sample report as PDF and as DOCX gives the
 * same three candidates as the text; the type comes from the bytes, not the
 * name; a file over 5 MB, a PDF over 60 pages and a file of another kind are
 * refused with the plain message.
 */
import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { findingCandidates } from "@/lib/registers/findings-parse";
import {
  FINDINGS_FILE_MAX_BYTES,
  REPORT_REFUSALS,
  sniffReport,
  textFromDocx,
  textFromPdf,
  textFromReport,
} from "./findings-text";

const txt = readFileSync("fixtures/findings/sample-report.txt", "utf8");
const pdf = new Uint8Array(readFileSync("fixtures/findings/sample-report.pdf"));
const docx = new Uint8Array(
  readFileSync("fixtures/findings/sample-report.docx"),
);

describe("the report's text (REQ-033 AC-2)", () => {
  it("reads the same three candidates from the text, the PDF and the Word file", async () => {
    const fromText = findingCandidates(txt).map((c) => c.text);
    expect(fromText).toHaveLength(3);
    const p = await textFromReport(pdf);
    expect(p.ok && p.kind).toBe("pdf");
    if (p.ok) {
      expect(p.pages).toBe(1);
      expect(findingCandidates(p.text).map((c) => c.text)).toEqual(fromText);
    }
    const d = await textFromReport(docx);
    expect(d.ok && d.kind).toBe("docx");
    if (d.ok)
      expect(findingCandidates(d.text).map((c) => c.text)).toEqual(fromText);
    expect(textFromDocx(docx)).toContain("Summary of findings");
  });

  it("knows the kind from the bytes and refuses anything else", async () => {
    expect(sniffReport(pdf)).toBe("pdf");
    expect(sniffReport(docx)).toBe("docx");
    expect(
      sniffReport(new TextEncoder().encode("hello, not a report")),
    ).toBeNull();
    // A zip that is not a Word file.
    expect(
      sniffReport(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0])),
    ).toBeNull();
    const other = await textFromReport(new TextEncoder().encode("%PDX- nope"));
    expect(other).toEqual({ ok: false, message: REPORT_REFUSALS.notAReport });
  });

  it("SR-1: refuses a file over 5 MB and a PDF over 60 pages, and times out a slow read", async () => {
    const big = new Uint8Array(FINDINGS_FILE_MAX_BYTES + 1);
    big.set([0x25, 0x50, 0x44, 0x46, 0x2d]);
    expect(await textFromReport(big)).toEqual({
      ok: false,
      message: REPORT_REFUSALS.tooBig,
    });
    const many = await PDFDocument.create();
    for (let i = 0; i < 61; i += 1) many.addPage([200, 200]);
    const manyBytes = await many.save();
    expect(await textFromPdf(manyBytes)).toEqual({
      ok: false,
      message: REPORT_REFUSALS.tooManyPages,
    });
    expect(await textFromPdf(pdf, { maxMs: 0 })).toEqual({
      ok: false,
      message: REPORT_REFUSALS.tooSlow,
    });
  });
});
