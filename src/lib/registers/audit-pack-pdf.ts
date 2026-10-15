/**
 * The audit pack's cover sheet (REQ-020 FR-1, FR-10): one page, the trading
 * name and date, the general-information line, the records table (name,
 * rows, last entry, state) in the audit-day order, and the list of files in
 * the zip. pdf-lib, the readiness summary's renderer, no browser.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { BRAND, GENERAL_INFORMATION_NOTICE } from "@/lib/brand";
import { packIntro, type PackLine } from "./audit-pack";

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 50;

export async function renderCoverSheet(input: {
  tradingName: string;
  date: string;
  lines: PackLine[];
  files: string[];
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;
  const ink = rgb(0.1, 0.1, 0.1);
  const text = (s: string, size: number, f = font, x = MARGIN) => {
    if (y < MARGIN + 40) {
      page = pdf.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - MARGIN;
    }
    page.drawText(s, { x, y, size, font: f, color: ink });
    y -= size + 6;
  };
  const wrap = (
    s: string,
    size: number,
    f = font,
    width = PAGE.width - 2 * MARGIN,
  ) => {
    const words = s.split(/\s+/);
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(next, size) > width && line) {
        text(line, size, f);
        line = w;
      } else line = next;
    }
    if (line) text(line, size, f);
  };

  text("Audit pack", 20, bold);
  wrap(packIntro(input.tradingName, input.date), 11);
  y -= 8;
  wrap(GENERAL_INFORMATION_NOTICE, 9);
  y -= 10;
  text("What is inside, and the state of each record", 13, bold);
  y -= 2;
  const cols = [MARGIN, MARGIN + 250, MARGIN + 300, MARGIN + 390];
  const header = ["Record", "Rows", "Last entry", "State"];
  header.forEach((h, i) =>
    page.drawText(h, { x: cols[i], y, size: 10, font: bold, color: ink }),
  );
  y -= 16;
  for (const l of input.lines) {
    if (y < MARGIN + 40) {
      page = pdf.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - MARGIN;
    }
    const cells = [l.name, String(l.rows), l.lastEntry ?? "none", l.state];
    cells.forEach((c, i) =>
      page.drawText(c.length > 48 ? `${c.slice(0, 47)}…` : c, {
        x: cols[i],
        y,
        size: 10,
        font,
        color: ink,
      }),
    );
    y -= 14;
  }
  y -= 10;
  text("Files in this pack", 13, bold);
  for (const f of input.files) text(f, 9);
  y -= 10;
  wrap(
    `Prepared with ${BRAND}. The provider's registers and documents are their own; this sheet lists what is in the pack and says nothing about the audit's outcome.`,
    9,
  );
  return pdf.save();
}
