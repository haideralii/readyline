/**
 * The document standard as a lint over rendered .docx files (REQ-016 FR-1):
 * S-2 document control on page one and a change log at the end, S-3 type
 * (Calibri or Arial, body 12 pt or larger, Word heading styles, left-aligned,
 * tables with borders and repeated header rows, a footer with title, version
 * and Page X of Y), S-5 no cue by colour alone (every tinted cell carries
 * text; every tailored section is marked in words), S-7 audit order across a
 * set, and FR-0a no instruction phrasing in a placeholder. Reads the XML
 * inside the zip; no Word needed. Reports the fonts and heading styles found
 * so the CI job can print them.
 */
import { strFromU8, unzipSync } from "fflate";
import { auditOrder } from "./set-order";
import { findInstructionLeaks } from "./placeholders";
import { BLANK, lintBlanks } from "./blanks";
import { factKeyFor } from "./facts-fill";

export type DocxFinding = { rule: string; detail: string };

/**
 * Blanks counted per document from the rendered text (D-541 as amended):
 * a fact blank is one the provider fills from the account or the Finish
 * form ("[name]", "[phone or email]"); a row template in a register
 * ("[Code]", "[Summary]") is not. Sections are the Heading 1 parts.
 */
export type DocxBlankCount = {
  sections: number;
  factBlanks: number;
  sectionsWithFactBlanks: number;
};

export type DocxReport = {
  findings: DocxFinding[];
  /** Reported, not failing: the old "[Provider to complete: …]" style in a recorded model reply, until the next recording session (D-542). */
  warnings: DocxFinding[];
  fonts: string[];
  /** Run sizes in half-points found in the body, smallest first. */
  sizes: number[];
  headingStyles: string[];
  headings: number;
  blanks: DocxBlankCount;
};

/** Fact blanks per Heading 1 section of the body XML. */
export function countFactBlanks(body: string): DocxBlankCount {
  const chunks: string[] = [];
  let current: string | null = null;
  for (const p of body.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []) {
    if (/<w:pStyle w:val="Heading1"\/>/.test(p)) {
      if (current !== null) chunks.push(current);
      current = "";
    }
    // The title block before the first heading is not a section.
    if (current === null) continue;
    current += ` ${text(p)}`;
  }
  if (current !== null) chunks.push(current);
  let factBlanks = 0;
  let sectionsWithFactBlanks = 0;
  for (const chunk of chunks) {
    const n = [...chunk.matchAll(BLANK)].filter((m) =>
      Boolean(factKeyFor(m[0])),
    ).length;
    factBlanks += n;
    if (n > 0) sectionsWithFactBlanks += 1;
  }
  return { sections: chunks.length, factBlanks, sectionsWithFactBlanks };
}

function xmlOf(files: Record<string, Uint8Array>, name: string): string {
  const f = files[name];
  return f ? strFromU8(f) : "";
}

function text(xml: string): string {
  return xml
    .replace(/<w:tab\/>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/** The text of each table in document order. */
function tables(xml: string): string[] {
  return (xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) ?? []).map(text);
}

export function lintDocx(
  buffer: Uint8Array,
  options: { title?: string; expectedSections?: number } = {},
): DocxReport {
  const files = unzipSync(buffer);
  const body = xmlOf(files, "word/document.xml");
  const styles = xmlOf(files, "word/styles.xml");
  const footer = Object.keys(files)
    .filter((n) => /^word\/footer\d*\.xml$/.test(n))
    .map((n) => xmlOf(files, n))
    .join("\n");
  const findings: DocxFinding[] = [];
  const warnings: DocxFinding[] = [];
  const fail = (rule: string, detail: string) =>
    findings.push({ rule, detail });

  // S-3 type: default font and size from styles, every explicit run size in the body.
  const fonts = [
    ...new Set(
      [...`${styles}\n${body}`.matchAll(/w:ascii="([^"]+)"/g)].map((m) => m[1]),
    ),
  ];
  const sizes = [
    ...new Set(
      [...body.matchAll(/<w:sz w:val="(\d+)"\/>/g)].map((m) => Number(m[1])),
    ),
  ].sort((a, b) => a - b);
  const defaultSize = Number(
    styles.match(/<w:docDefaults>[\s\S]*?<w:sz w:val="(\d+)"\/>/)?.[1] ?? 0,
  );
  if (!fonts.every((f) => f === "Calibri" || f === "Arial"))
    fail("s3-font", `fonts other than Calibri or Arial: ${fonts.join(", ")}`);
  if (defaultSize < 24)
    fail("s3-size", `default body size ${defaultSize / 2} pt is under 12 pt`);
  // The section mark ("Drafted from your answers") is a 10 pt italic line; everything else is 12 pt or larger.
  const small = sizes.filter((s) => s < 24 && s !== 20);
  if (small.length)
    fail(
      "s3-size",
      `run sizes under 12 pt: ${small.map((s) => `${s / 2} pt`).join(", ")}`,
    );
  if (/<w:jc w:val="both"\/>/.test(body))
    fail("s3-justified", "justified text found");
  const headingStyles = [
    ...new Set(
      [...body.matchAll(/<w:pStyle w:val="(Heading\d|Title)"\/>/g)].map(
        (m) => m[1],
      ),
    ),
  ];
  const headings = (body.match(/<w:pStyle w:val="Heading1"\/>/g) ?? []).length;
  if (headings === 0) fail("s3-headings", "no Heading 1 paragraphs");
  if (
    options.expectedSections !== undefined &&
    headings !== options.expectedSections
  )
    fail(
      "s3-headings",
      `${headings} Heading 1 paragraphs, expected ${options.expectedSections}`,
    );
  const headingTexts = [
    ...body.matchAll(
      /<w:p>(?:(?!<\/w:p>)[\s\S])*?<w:pStyle w:val="Heading1"\/>(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/g,
    ),
  ].map((m) => text(m[0]));
  for (const h of headingTexts)
    if (h.length > 3 && h === h.toUpperCase() && /[A-Z]/.test(h))
      fail("s3-caps", `ALL CAPS heading: ${h}`);

  // S-3 tables: visible borders on every cell, header row repeated. A one-cell
  // box (a callout or a marker) is not a data table and has no header row.
  const tbls = body.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) ?? [];
  for (const t of tbls) {
    const box =
      (t.match(/<w:tr[ >]/g) ?? []).length === 1 &&
      (t.match(/<w:tc>/g) ?? []).length === 1;
    if (
      !box &&
      !/<w:tblHeader\/>/.test(t) &&
      !/<w:tblHeader w:val="(?:1|true)"\/>/.test(t)
    )
      fail("s3-table-header", "a table has no repeating header row");
    if (/<w:tcBorders>[\s\S]*?w:val="nil"/.test(t) || !/<w:tcBorders>/.test(t))
      fail("s3-table-borders", "a table cell has no visible border");
  }

  // S-3 footer: title, version and Page X of Y.
  const footerText = text(footer);
  if (
    !/<w:fldSimple w:instr="PAGE"|PAGE/.test(footer) ||
    !/NUMPAGES/.test(footer)
  )
    fail("s3-footer", "footer has no Page X of Y field");
  if (!/Version \S+/.test(footerText))
    fail("s3-footer", "footer has no version");
  if (options.title && !footerText.includes(options.title))
    fail("s3-footer", "footer has no title");

  // S-2 document control on page one and a change log at the end.
  const all = tables(body);
  const first = all[0] ?? "";
  for (const row of [
    "Document",
    "Provider",
    "Version",
    "Approver",
    "Approval date",
    "Next review",
    "Standards it supports",
  ])
    if (!first.includes(row))
      fail("s2-control", `document control table lacks "${row}"`);
  const last = all.at(-1) ?? "";
  if (!(last.includes("What changed") && last.includes("By whom")))
    fail("s2-change-log", "no change log table at the end");
  const plain = text(body);
  const lastHeading = headingTexts.at(-1) ?? "";
  if (!/Change log$/.test(lastHeading))
    fail(
      "s2-change-log",
      `last section is "${lastHeading}", not the change log`,
    );

  // S-5: a tinted cell always carries text; a drafted section is marked in words.
  for (const cell of body.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? [])
    if (
      /<w:shd[^>]*w:fill="(?:FFF4CE|FBE9D7)"/.test(cell) &&
      text(cell).trim().length === 0
    )
      fail("s5-colour-only", "a tinted cell carries no text");
  if (
    /w:fill="FFF4CE"/.test(body) &&
    !/\[|Generic text|Not yet drafted/.test(plain)
  )
    fail(
      "s5-colour-only",
      "a callout tint without a bracketed blank or a marker in words",
    );

  // FR-0a and S-8: placeholders in the customer's voice, blanks of at most six
  // words with no instruction. The S-8 rule is for blanks inside sentences;
  // the whole-section placeholder of an undrafted section and the markers sit
  // in tinted boxes and are judged by FR-0a instead.
  for (const leak of findInstructionLeaks(plain))
    fail("fr0a-instruction", `${leak.placeholder} ("${leak.phrase}")`);
  const outsideBoxes = text(
    body.replace(
      /<w:tc>(?:(?!<\/w:tc>)[\s\S])*?<w:shd[^>]*w:fill="FFF4CE"(?:(?!<\/w:tc>)[\s\S])*?<\/w:tc>/g,
      "",
    ),
  );
  for (const b of lintBlanks(outsideBoxes)) {
    // An old-style "[Provider to …]" blank comes from a recorded model reply (D-542): reported, not failing.
    if (/^\[Provider to /i.test(b.blank))
      warnings.push({ rule: "s8-blank", detail: `${b.blank} (${b.reason})` });
    else fail("s8-blank", `${b.blank} (${b.reason})`);
  }
  // Recorded model replies still use the old style until the next recording session (D-542): reported, not failing.
  if (/Provider to complete/.test(plain))
    warnings.push({
      rule: "s8-blank",
      detail:
        'old-style placeholder "Provider to complete" in a recorded reply',
    });

  // D-058: the notices live at the point of delivery, never in the document.
  if (/not legal advice|generated with AI/i.test(plain))
    fail("d058-notice", "a delivery notice is inside the document");

  return {
    findings,
    warnings,
    fonts,
    sizes,
    headingStyles,
    headings,
    blanks: countFactBlanks(body),
  };
}

/** S-7: the files of a set, by type id, in audit order. */
export function lintSetOrder(typeIds: readonly string[]): DocxFinding[] {
  const expected = auditOrder(typeIds);
  const same = expected.every((id, i) => typeIds[i] === id);
  return same
    ? []
    : [{ rule: "s7-order", detail: `expected ${expected.join(", ")}` }];
}
