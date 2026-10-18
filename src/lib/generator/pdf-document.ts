import { PDFDocument, rgb, StandardFonts, type PDFFont } from "pdf-lib";
import { BRAND } from "@/lib/brand";
import type { DocumentModel } from "./document-model";
import { footerLead } from "./render-docx";
import type { Block } from "./section-schema";

/**
 * REQ-034 FR-4, SR-2 (D-2947): a document model as a PDF, for the sample
 * a buyer opens on a phone. The same model the Word file is rendered from;
 * the title, each numbered section with its blocks (paragraphs, bullets,
 * steps, callouts, tables as rows), and on every page the same footer the
 * Word file carries (`footerLead`) with the page number. Rendered with
 * pdf-lib, the readiness summary's renderer: no LibreOffice on the server,
 * nothing leaves it, no model is called. The look is ours, not Word's.
 */
const PAGE = { width: 595.28, height: 841.89 }; // A4 portrait, points
const MARGIN = 48;
const FOOTER_Y = 28;
const BODY = 10.5;
const LEADING = 4;

/** WinAnsi covers Latin-1 and the common typographic marks; anything else becomes a question mark rather than a thrown encode. */
function safe(text: string): string {
  return text.replace(/[^\u0000-ÿ‘’“”–—•…]/gu, "?");
}

function wrap(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = safe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderDocumentPdf(
  model: DocumentModel,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(model.title);
  pdf.setProducer(BRAND);
  pdf.setCreator(BRAND);
  const stamp = new Date(`${model.generatedAt}T00:00:00Z`);
  pdf.setCreationDate(stamp);
  pdf.setModificationDate(stamp);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.11, 0.17, 0.16);
  const slate = rgb(0.35, 0.4, 0.4);
  const width = PAGE.width - MARGIN * 2;

  let page = pdf.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;
  const bottom = MARGIN + 12;

  const newPageIfNeeded = (needed: number) => {
    if (y - needed < bottom) {
      page = pdf.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - MARGIN;
    }
  };
  const lines = (
    text: string,
    size = BODY,
    f: PDFFont = font,
    indent = 0,
    color = ink,
  ) => {
    for (const l of wrap(text, f, size, width - indent)) {
      newPageIfNeeded(size + LEADING);
      page.drawText(l, { x: MARGIN + indent, y, size, font: f, color });
      y -= size + LEADING;
    }
  };
  const gap = (n = 6) => {
    y -= n;
  };

  lines(model.title, 18, bold);
  lines(
    `Version ${model.version}. Drafted ${model.generatedAt}. Review due ${model.reviewDueAt}.`,
    9,
    font,
    0,
    slate,
  );
  gap(10);

  const block = (b: Block) => {
    switch (b.type) {
      case "paragraph":
        lines(b.text);
        gap();
        return;
      case "callout":
        lines(`Note: ${b.text}`, BODY, bold);
        gap();
        return;
      case "bullets":
        for (const item of b.items) lines(`•  ${item}`, BODY, font, 12);
        gap();
        return;
      case "steps":
        b.items.forEach((item, i) =>
          lines(`${i + 1}.  ${item}`, BODY, font, 12),
        );
        gap();
        return;
      case "table":
        lines(b.columns.join("  |  "), BODY, bold);
        for (const row of b.rows) lines(row.join("  |  "));
        gap();
        return;
    }
  };

  for (const s of model.sections) {
    newPageIfNeeded(13 + LEADING + BODY + LEADING + 6);
    lines(s.number ? `${s.number} ${s.heading}` : s.heading, 13, bold);
    gap(2);
    for (const b of s.blocks) block(b);
    gap(6);
  }

  // The footer on every page, once the count is known (FR-4: on every page).
  const lead = footerLead(model, false);
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const text = safe(`${lead} Page ${i + 1} of ${pages.length}`);
    const size = 8;
    const w = font.widthOfTextAtSize(text, size);
    p.drawText(text, {
      x: w > width ? MARGIN : (PAGE.width - w) / 2,
      y: FOOTER_Y,
      size,
      font,
      color: slate,
      maxWidth: width,
    });
  });

  return pdf.save();
}
