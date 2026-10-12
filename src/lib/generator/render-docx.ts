/**
 * Deterministic rendering of a DocumentModel to .docx with the `docx`
 * package (REQ-005 D-501). One block type maps to one Word construct; headings
 * use Word's built-in styles so the outline works in Word and LibreOffice,
 * and the footer carries "Prepared with Readyline", the version and the page
 * number (FR-3).
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
import type { DocumentModel, ResolvedSection } from "./document-model";
import type { Block } from "./section-schema";

const FONT = "Calibri";
const BODY_SIZE = 22; // half-points: 11pt

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

function text(
  t: string,
  opts: { bold?: boolean; italics?: boolean } = {},
): TextRun {
  return new TextRun({ text: t, font: FONT, size: BODY_SIZE, ...opts });
}

function paragraph(t: string): Paragraph {
  return new Paragraph({ children: [text(t)], spacing: { after: 120 } });
}

function table(columns: string[], rows: string[][]): Table {
  const width = Math.floor(9000 / columns.length);
  const header = new TableRow({
    tableHeader: true,
    children: columns.map(
      (c) =>
        new TableCell({
          width: { size: width, type: WidthType.DXA },
          borders: BORDERS,
          shading: { type: ShadingType.CLEAR, fill: "EEEEEE" },
          children: [new Paragraph({ children: [text(c, { bold: true })] })],
        }),
    ),
  });
  const body = rows.map(
    (r) =>
      new TableRow({
        children: r.map(
          (cell) =>
            new TableCell({
              width: { size: width, type: WidthType.DXA },
              borders: BORDERS,
              children: [new Paragraph({ children: [text(cell)] })],
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

function callout(t: string): Table {
  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    columnWidths: [9000],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 9000, type: WidthType.DXA },
            borders: BORDERS,
            shading: { type: ShadingType.CLEAR, fill: "FFF4CE" },
            children: [
              new Paragraph({ children: [text(t, { italics: true })] }),
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
): (Paragraph | Table)[] {
  switch (block.type) {
    case "paragraph":
      return [paragraph(block.text)];
    case "bullets":
      return block.items.map(
        (item) =>
          new Paragraph({
            children: [text(item)],
            numbering: { reference: "bullets", level: 0 },
            spacing: { after: 60 },
          }),
      );
    case "steps":
      return block.items.map(
        (item) =>
          new Paragraph({
            children: [text(item)],
            numbering: { reference: stepsRef, level: 0 },
            spacing: { after: 60 },
          }),
      );
    case "table":
      return [table(block.columns, block.rows), paragraph("")];
    case "callout":
      return [callout(block.text), paragraph("")];
  }
}

function sectionChildren(
  section: ResolvedSection,
  stepsRef: string,
): (Paragraph | Table)[] {
  const headingText = section.number
    ? `${section.number} ${section.heading}`
    : section.heading;
  const heading = new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text: headingText, font: FONT, bold: true })],
    spacing: { before: 240, after: 120 },
  });
  return [
    heading,
    ...section.blocks.flatMap((b) => blockToChildren(b, stepsRef)),
  ];
}

export function buildDocx(model: DocumentModel): Document {
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
      children: [text(model.facts.tradingName, { italics: true })],
      spacing: { after: 240 },
    }),
    ...model.sections.flatMap((s, i) => sectionChildren(s, stepsRefs[i])),
  ];

  const section: ISectionOptions = {
    properties: {},
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [text(`${model.facts.tradingName}: ${model.title}`)],
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
              text(`${model.footer}. Version ${model.version}. Page `),
              new TextRun({
                children: [PageNumber.CURRENT],
                font: FONT,
                size: BODY_SIZE,
              }),
              text(" of "),
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
    creator: model.footer,
    title: model.title,
    description: `${model.title} for ${model.facts.tradingName}`,
    styles: {
      default: {
        document: { run: { font: FONT, size: BODY_SIZE } },
        heading1: {
          run: { font: FONT, size: 28, bold: true, color: "000000" },
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

export async function renderDocx(model: DocumentModel): Promise<Buffer> {
  return Packer.toBuffer(buildDocx(model));
}
