/**
 * Deterministic rendering of a DocumentModel to .docx with the `docx`
 * package (REQ-005 D-501; REQ-016 S-2, S-3, S-5, S-8). One block type maps
 * to one Word construct; headings use Word's built-in styles so the outline
 * works in Word and LibreOffice; body text is Calibri 12 pt, left-aligned,
 * 1.15 line spacing with paragraph spacing; tables carry visible borders and
 * a header row that repeats across pages; the footer carries the title, the
 * version and "Page X of Y" on every page, plus the draft mark until the
 * provider adopts the document. A tailored section is marked in words
 * ("Drafted from your answers"), never by colour alone; a bracketed blank
 * such as [name] is highlighted in a light tint with the brackets kept, so
 * the cue survives black-and-white printing. The plain-language summary of
 * a participant-facing document is set at 16 pt (S-4).
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ISectionOptions,
} from "docx";
import { BLANK } from "./blanks";
import type { DocumentModel, ResolvedSection } from "./document-model";
import { GENERIC_MARKER } from "./fallback-text";
import type { Block } from "./section-schema";

export const FONT = "Calibri";
/** Half-points: 12 pt body (S-3), 16 pt for the plain-language summary (S-4). */
export const BODY_SIZE = 24;
export const LARGE_PRINT_SIZE = 32;
/** 1.15 line spacing in 240ths of a line (S-3). */
export const LINE_SPACING = 276;
/** A light tint of the ochre for blanks (S-8); readable in black and white because the brackets stay. */
export const BLANK_FILL = "FBE9D7";
export const CALLOUT_FILL = "FFF4CE";
export const TAILORED_MARK = "Drafted from your answers.";
export const DRAFT_FOOTER_SUFFIX = "Draft prepared with";

const cellBorder = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: "999999",
} as const;
const BORDERS = {
  top: cellBorder,
  bottom: cellBorder,
  left: cellBorder,
  right: cellBorder,
};

type RunOpts = {
  bold?: boolean;
  italics?: boolean;
  size?: number;
  color?: string;
};

function run(t: string, opts: RunOpts = {}): TextRun {
  return new TextRun({
    text: t,
    font: FONT,
    size: opts.size ?? BODY_SIZE,
    ...opts,
  });
}

/** Splits text on bracketed blanks so each blank becomes a highlighted run (S-8). */
export function runsFor(t: string, opts: RunOpts = {}): TextRun[] {
  const out: TextRun[] = [];
  let last = 0;
  for (const m of t.matchAll(BLANK)) {
    const at = m.index ?? 0;
    if (at > last) out.push(run(t.slice(last, at), opts));
    out.push(
      new TextRun({
        text: m[0],
        font: FONT,
        size: opts.size ?? BODY_SIZE,
        bold: opts.bold,
        italics: opts.italics,
        shading: { type: ShadingType.CLEAR, fill: BLANK_FILL },
      }),
    );
    last = at + m[0].length;
  }
  if (last < t.length || t.length === 0) out.push(run(t.slice(last), opts));
  return out;
}

function paragraph(t: string, size?: number): Paragraph {
  return new Paragraph({
    children: runsFor(t, { size }),
    spacing: { after: 120, line: LINE_SPACING },
  });
}

function table(columns: string[], rows: string[][], size?: number): Table {
  const width = Math.floor(9000 / columns.length);
  const header = new TableRow({
    tableHeader: true,
    children: columns.map(
      (c) =>
        new TableCell({
          width: { size: width, type: WidthType.DXA },
          borders: BORDERS,
          shading: { type: ShadingType.CLEAR, fill: "EEEEEE" },
          children: [
            new Paragraph({ children: runsFor(c, { bold: true, size }) }),
          ],
        }),
    ),
  });
  const body = rows.map(
    (r) =>
      new TableRow({
        cantSplit: true,
        children: r.map(
          (cell) =>
            new TableCell({
              width: { size: width, type: WidthType.DXA },
              borders: BORDERS,
              children: [new Paragraph({ children: runsFor(cell, { size }) })],
            }),
        ),
      }),
  );
  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    columnWidths: columns.map(() => width),
    rows: [header, ...body],
  });
}

/** A boxed line: the marker words carry the meaning, the tint is the second cue (S-5). */
function callout(t: string, size?: number): Table {
  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    columnWidths: [9000],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 9000, type: WidthType.DXA },
            borders: BORDERS,
            shading: { type: ShadingType.CLEAR, fill: CALLOUT_FILL },
            children: [
              new Paragraph({ children: runsFor(t, { italics: true, size }) }),
            ],
          }),
        ],
      }),
    ],
  });
}

function blockToChildren(
  block: Block,
  stepsRef: string,
  size?: number,
): (Paragraph | Table)[] {
  switch (block.type) {
    case "paragraph":
      return [paragraph(block.text, size)];
    case "bullets":
      return block.items.map(
        (item) =>
          new Paragraph({
            children: runsFor(item, { size }),
            numbering: { reference: "bullets", level: 0 },
            spacing: { after: 60, line: LINE_SPACING },
          }),
      );
    case "steps":
      return block.items.map(
        (item) =>
          new Paragraph({
            children: runsFor(item, { size }),
            numbering: { reference: stepsRef, level: 0 },
            spacing: { after: 60, line: LINE_SPACING },
          }),
      );
    case "table":
      return [table(block.columns, block.rows, size), paragraph("")];
    case "callout":
      return [callout(block.text, size), paragraph("")];
  }
}

/** What a section is marked with, in words (S-5); nothing for fixed text and for an adopted document. */
export function sectionMark(
  section: ResolvedSection,
  adopted: boolean,
): string | null {
  if (adopted) return null;
  if (section.status === "generated") return TAILORED_MARK;
  if (section.status === "placeholder") return "Not yet drafted.";
  return null; // fallback sections carry the generic marker in their first callout
}

function sectionChildren(
  section: ResolvedSection,
  stepsRef: string,
  adopted: boolean,
): (Paragraph | Table)[] {
  const headingText = section.number
    ? `${section.number} ${section.heading}`
    : section.heading;
  const size =
    section.id === "plain-language-summary" ? LARGE_PRINT_SIZE : undefined;
  const heading = new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text: headingText, font: FONT, bold: true })],
    spacing: { before: 240, after: 120 },
  });
  const mark = sectionMark(section, adopted);
  const marked = mark
    ? [
        new Paragraph({
          children: [run(mark, { italics: true, color: "555555", size: 20 })],
          spacing: { after: 80 },
        }),
      ]
    : [];
  return [
    heading,
    ...marked,
    ...section.blocks.flatMap((b) => blockToChildren(b, stepsRef, size)),
  ];
}

export type RenderOptions = {
  /** True once the provider has marked the document adopted: the draft footer mark and the section marks go (D-058). */
  adopted?: boolean;
};

/** The footer text before the page number (S-3, D-058). */
export function footerLead(model: DocumentModel, adopted: boolean): string {
  const base = `${model.title}. Version ${model.version}.`;
  return adopted || !model.footer ? base : `${base} ${model.footer}.`;
}

export function buildDocx(
  model: DocumentModel,
  options: RenderOptions = {},
): Document {
  const adopted = options.adopted ?? false;
  const stepsRefs = model.sections.map((s) => `steps-${s.id}`);
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [
        new TextRun({ text: model.title, font: FONT, bold: true, size: 40 }),
      ],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [run(model.facts.tradingName, { italics: true })],
      spacing: { after: 240 },
    }),
    ...model.sections.flatMap((s, i) =>
      sectionChildren(s, stepsRefs[i], adopted),
    ),
  ];

  const section: ISectionOptions = {
    properties: {},
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [run(`${model.facts.tradingName}: ${model.title}`)],
          }),
        ],
      }),
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              run(`${footerLead(model, adopted)} Page `),
              new TextRun({
                children: [PageNumber.CURRENT],
                font: FONT,
                size: BODY_SIZE,
              }),
              run(" of "),
              new TextRun({
                children: [PageNumber.TOTAL_PAGES],
                font: FONT,
                size: BODY_SIZE,
              }),
            ],
          }),
        ],
      }),
    },
    children,
  };

  return new Document({
    creator: adopted ? model.facts.tradingName : model.footer,
    title: model.title,
    description: `${model.title} for ${model.facts.tradingName}`,
    styles: {
      default: {
        document: {
          run: { font: FONT, size: BODY_SIZE },
          paragraph: {
            alignment: AlignmentType.LEFT,
            spacing: { line: LINE_SPACING, after: 120 },
          },
        },
        heading1: {
          run: { font: FONT, size: 28, bold: true, color: "000000" },
        },
        heading2: {
          run: { font: FONT, size: BODY_SIZE, bold: true, color: "000000" },
        },
        title: { run: { font: FONT, size: 40, bold: true, color: "000000" } },
      },
    },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
        ...stepsRefs.map((reference) => ({
          reference,
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        })),
      ],
    },
    sections: [section],
  });
}

export async function renderDocx(
  model: DocumentModel,
  options: RenderOptions = {},
): Promise<Buffer> {
  return Packer.toBuffer(buildDocx(model, options));
}

export { GENERIC_MARKER };
