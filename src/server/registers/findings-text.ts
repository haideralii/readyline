/**
 * The text of an uploaded auditor's report, read in the request and never
 * stored (REQ-033 FR-1, SR-1; D-2930): a PDF through pdfjs (the browsers'
 * reader, legacy build for Node), a DOCX through its document.xml. Every
 * cap refuses with a plain message: 5 MB, 60 pages, 10 seconds, and the
 * file's first bytes decide its type, not its name.
 */
import { strFromU8, unzipSync } from "fflate";

export const FINDINGS_FILE_MAX_BYTES = 5 * 1024 * 1024;
export const FINDINGS_FILE_MAX_PAGES = 60;
export const FINDINGS_FILE_MAX_MS = 10_000;

export type ReportKind = "pdf" | "docx";

export type ReportText =
  | { ok: true; kind: ReportKind; text: string; pages: number }
  | { ok: false; message: string };

export const REPORT_REFUSALS = {
  tooBig:
    "The file is over 5 MB. Export a smaller PDF or paste the findings instead.",
  tooManyPages:
    "The file has more than 60 pages. Export the findings pages alone or paste them instead.",
  tooSlow: "Reading the file took too long. Paste the findings instead.",
  notAReport:
    "That file is not a PDF or a Word document. Export the report as one of those, or paste the findings.",
  unreadable: "The file could not be read. Paste the findings instead.",
} as const;

/** The type from the first bytes: "%PDF-" or a zip holding word/document.xml. */
export function sniffReport(bytes: Uint8Array): ReportKind | null {
  if (bytes.length >= 5 && strFromU8(bytes.slice(0, 5)) === "%PDF-")
    return "pdf";
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  ) {
    try {
      const files = unzipSync(bytes, {
        filter: (f) => f.name === "word/document.xml",
      });
      if (files["word/document.xml"]) return "docx";
    } catch {
      return null;
    }
  }
  return null;
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

/** A DOCX's paragraphs, one per line; table cells joined with tabs so the splitter reads a row. */
export function textFromDocx(bytes: Uint8Array): string {
  const files = unzipSync(bytes, {
    filter: (f) => f.name === "word/document.xml",
  });
  const xml = strFromU8(files["word/document.xml"]);
  const decode = (s: string) =>
    s.replace(/&(amp|lt|gt|quot|apos);|&#(\d+);/g, (m, name, code) =>
      code ? String.fromCodePoint(Number(code)) : (ENTITIES[m] ?? m),
    );
  const runText = (p: string) =>
    (p.match(/<w:t(?: [^>]*)?>[^<]*<\/w:t>|<w:tab\/>|<w:br\/>/g) ?? [])
      .map((r) =>
        r === "<w:tab/>"
          ? "\t"
          : r === "<w:br/>"
            ? " "
            : r.replace(/<[^>]+>/g, ""),
      )
      .join("");
  const lines: string[] = [];
  // Table rows first: the cells of a row become one tab-joined line, then the rows are blanked out.
  let rest = xml;
  for (const row of xml.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) ?? []) {
    const cells = (row.match(/<w:tc[ >][\s\S]*?<\/w:tc>/g) ?? []).map((c) =>
      (c.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []).map(runText).join(" ").trim(),
    );
    lines.push(cells.join("\t"));
    rest = rest.replace(row, "");
  }
  // An empty paragraph is self-closing; it is the blank line between two findings.
  for (const p of rest.match(/<w:p\/>|<w:p[ >][\s\S]*?<\/w:p>/g) ?? [])
    lines.push(p === "<w:p/>" ? "" : runText(p));
  return decode(lines.join("\n"));
}

/** A PDF's text, page by page, within the page and time caps. */
export async function textFromPdf(
  bytes: Uint8Array,
  caps: { maxPages?: number; maxMs?: number } = {},
): Promise<ReportText> {
  const maxPages = caps.maxPages ?? FINDINGS_FILE_MAX_PAGES;
  const maxMs = caps.maxMs ?? FINDINGS_FILE_MAX_MS;
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const started = Date.now();
  // pdfjs takes the buffer over (it is emptied after the read), so it gets a copy and the caller keeps theirs.
  const task = pdfjs.getDocument({
    data: bytes.slice(),
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0,
  });
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), maxMs),
  );
  try {
    const pdf = await Promise.race([task.promise, timeout]);
    try {
      if (Date.now() - started >= maxMs)
        return { ok: false, message: REPORT_REFUSALS.tooSlow };
      if (pdf.numPages > maxPages)
        return { ok: false, message: REPORT_REFUSALS.tooManyPages };
      const pages: string[] = [];
      for (let i = 1; i <= pdf.numPages; i += 1) {
        if (Date.now() - started > maxMs)
          return { ok: false, message: REPORT_REFUSALS.tooSlow };
        const page = await Promise.race([pdf.getPage(i), timeout]);
        const content = await Promise.race([page.getTextContent(), timeout]);
        // Items on one line share a y; a new y starts a new line; a gap wider than the usual line
        // step is a paragraph break, written as a blank line so the splitter sees the paragraphs.
        let lastY: number | null = null;
        let line = "";
        const lines: string[] = [];
        const gaps: number[] = [];
        const rows: { y: number; text: string }[] = [];
        for (const item of content.items) {
          if (!("str" in item)) continue;
          const y = Math.round(item.transform[5]);
          if (lastY !== null && Math.abs(y - lastY) > 2) {
            rows.push({ y: lastY, text: line });
            gaps.push(Math.abs(y - lastY));
            line = "";
          }
          line += (line && !line.endsWith(" ") ? " " : "") + item.str;
          lastY = y;
        }
        if (line && lastY !== null) rows.push({ y: lastY, text: line });
        const usual = gaps.length
          ? [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)]
          : 0;
        rows.forEach((r, i) => {
          if (
            i > 0 &&
            usual > 0 &&
            Math.abs(r.y - rows[i - 1].y) > usual * 1.25
          )
            lines.push("");
          lines.push(r.text);
        });
        pages.push(lines.join("\n"));
      }
      return {
        ok: true,
        kind: "pdf",
        text: pages.join("\n\n"),
        pages: pdf.numPages,
      };
    } finally {
      await pdf.destroy();
    }
  } catch (e) {
    if (e instanceof Error && e.message === "timeout")
      return { ok: false, message: REPORT_REFUSALS.tooSlow };
    return { ok: false, message: REPORT_REFUSALS.unreadable };
  }
}

/** The report's text by its bytes alone, within every cap (SR-1). */
export async function textFromReport(bytes: Uint8Array): Promise<ReportText> {
  if (bytes.byteLength > FINDINGS_FILE_MAX_BYTES)
    return { ok: false, message: REPORT_REFUSALS.tooBig };
  const kind = sniffReport(bytes);
  if (kind === "pdf") return textFromPdf(bytes);
  if (kind === "docx") {
    try {
      return { ok: true, kind, text: textFromDocx(bytes), pages: 1 };
    } catch {
      return { ok: false, message: REPORT_REFUSALS.unreadable };
    }
  }
  return { ok: false, message: REPORT_REFUSALS.notAReport };
}
