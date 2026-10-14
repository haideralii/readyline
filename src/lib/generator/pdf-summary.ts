/**
 * The PDF readiness summary that accompanies a generated set (REQ-005 FR-6;
 * REQ-016 D-058, S-8): the general-information notice and the AI disclosure
 * on the first page (they no longer sit inside the provider's documents),
 * then the pathway, modules, documents with their drafting status, the
 * blanks to fill by document and section, and the registers. Rendered with
 * pdf-lib so the output is deterministic and needs no browser.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { AI_DISCLOSURE, BRAND, GENERAL_INFORMATION_NOTICE } from "@/lib/brand";
import type { QuestionnaireResult } from "@/lib/questionnaire/result";
import type { DocumentBlank } from "./blanks";
import type { ProviderFacts } from "./facts";

export type SummaryDocumentLine = {
  title: string;
  status: "ready" | "review";
  fallbackSections: number;
};

export type SummaryInput = {
  facts: ProviderFacts;
  result: QuestionnaireResult;
  documents: SummaryDocumentLine[];
  /** Every bracketed blank in the set, by document and section (S-8). */
  blanks?: DocumentBlank[];
  generatedAt: string;
  version: string;
};

const PAGE = { width: 595.28, height: 841.89 }; // A4 portrait, points
const MARGIN = 48;

function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > maxChars) {
      if (line) lines.push(line);
      line = w;
    } else line = (line + " " + w).trim();
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderSummaryPdf(
  input: SummaryInput,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${BRAND} readiness summary: ${input.facts.tradingName}`);
  pdf.setProducer(BRAND);
  pdf.setCreator(BRAND);
  pdf.setCreationDate(new Date(`${input.generatedAt}T00:00:00Z`));
  pdf.setModificationDate(new Date(`${input.generatedAt}T00:00:00Z`));
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;
  const ink = rgb(0.11, 0.17, 0.16);

  const newPageIfNeeded = (needed: number) => {
    if (y - needed < MARGIN) {
      page = pdf.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - MARGIN;
    }
  };
  const line = (text: string, size = 11, f = font) => {
    for (const l of wrap(text, Math.floor(95 * (11 / size)))) {
      newPageIfNeeded(size + 4);
      page.drawText(l, { x: MARGIN, y, size, font: f, color: ink });
      y -= size + 4;
    }
  };
  const gap = (n = 8) => {
    y -= n;
  };

  line(`${BRAND} readiness summary`, 20, bold);
  line(input.facts.tradingName, 14, bold);
  line(`Drafted ${input.generatedAt}. Version ${input.version}.`, 10);
  gap(12);

  // D-058: the notices open the summary; the documents themselves are the provider's.
  line("About your documents", 14, bold);
  line(GENERAL_INFORMATION_NOTICE, 10);
  line(AI_DISCLOSURE, 10);
  line(
    'Each document is yours once you have reviewed it, filled in the blanks and adopted it. Until then its footer reads "Draft prepared with Readyline".',
    10,
  );
  gap(12);

  line("Your audit", 14, bold);
  line(
    `${input.result.pathway === "verification" ? "Verification" : "Certification"}${input.result.modifiedCertification ? " (modified scope)" : ""}. ${input.result.pathwayDescription}`,
  );
  line(
    `Registration groups in scope: ${input.result.groups.map((g) => `${g.code} ${g.name}`).join("; ")}.`,
  );
  line(
    input.result.midTermAudit.applies
      ? `Mid-term audit: about ${input.result.midTermAudit.monthsAfterRegistration} months after registration.`
      : "Mid-term audit: does not apply.",
  );
  gap(12);

  line(`Practice Standards modules (${input.result.modules.length})`, 14, bold);
  for (const m of input.result.modules)
    line(`${m.name}: ${m.standardCount} standards.`);
  gap(12);

  line(`Documents in this set (${input.documents.length})`, 14, bold);
  input.documents.forEach((d, i) => {
    line(
      d.status === "ready"
        ? `${i + 1}. ${d.title}: drafted.`
        : `${i + 1}. ${d.title}: drafted, with ${d.fallbackSections} generic section${d.fallbackSections === 1 ? "" : "s"} to make your own.`,
    );
  });
  gap(12);

  const blanks = input.blanks ?? [];
  line(
    blanks.length
      ? `Finish your pack: ${blanks.length} blank${blanks.length === 1 ? "" : "s"} to fill in`
      : "Finish your pack: no blanks to fill in",
    14,
    bold,
  );
  if (blanks.length)
    line(
      "Work through these top to bottom. Each is a bracketed blank inside a complete sentence; replace it with your detail.",
      10,
    );
  let currentDoc = "";
  for (const b of blanks) {
    if (b.title !== currentDoc) {
      currentDoc = b.title;
      gap(4);
      line(currentDoc, 11, bold);
    }
    line(
      `${b.sectionNumber ? `${b.sectionNumber} ` : ""}${b.sectionHeading}: ${b.blank}`,
      10,
    );
  }
  gap(12);

  line("Registers to keep after registration", 14, bold);
  for (const r of input.result.registers) line(r.title);
  gap(12);

  line(`Prepared with ${BRAND}.`, 9);

  return pdf.save();
}
