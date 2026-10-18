/**
 * The "Start here" sheet (REQ-026; D-2220, D-2221): what to do with the
 * documents, as one printable list built from the pack's own data and never
 * from the model. The builder is pure: it takes the set's documents (the
 * version the pack shipped and the latest version), what is adopted, the
 * result and the content file, and returns the sheet as data (for the page,
 * where lines tick as blanks are filled) and as a DocumentModel (for the
 * Word file, through the same renderer as every other document).
 */
import {
  glossaryContent,
  glossaryMeaning,
  startHereContent,
} from "@/lib/questionnaire/content";
import type { QuestionnaireResult } from "@/lib/questionnaire/result";
import { collectBlanks, type DocumentBlank } from "./blanks";
import type { DocumentModel, ResolvedSection } from "./document-model";
import { factKeyFor, formFactKeyFor, isAccountFactKey } from "./facts-fill";
import type { Block } from "./section-schema";
import { auditOrder, orderDocuments } from "./set-order";

export const START_HERE_FILE = "00-start-here.docx";
export const START_HERE_TITLE = "Start here";

/** The printed box in front of a line the provider ticks on paper. */
export const BOX = "☐ ";
/** The ticked box in front of a line the app already knows is done (REQ-024 A0, D-2441: the adopt line after adoption). */
export const TICK = "☑ ";

/** The document's adopt line: ticked and dated in words once its newest version is adopted, a box to tick until then. */
export function adoptLine(adopted: boolean): string {
  return adopted
    ? `${TICK}Adopt: adopted; the document control table carries the date.`
    : `${BOX}Adopt: sign and date the document control table, then mark it adopted on your documents page.`;
}

export type SheetDocumentInput = {
  typeId: string;
  /** The version the pack shipped: its blanks are the lines on the sheet. */
  original: DocumentModel;
  /** The latest version: a blank missing from it is done. */
  latest: DocumentModel;
  adopted: boolean;
};

export type StartHereInput = {
  /**
   * REQ-029 FR-10 (D-2861): the account's facts. With `templateSet` true a
   * Fill in line is done when the facts hold its key, since the stored text
   * keeps its brackets; the approver and date lines fill on adoption. With
   * it false (a set made before REQ-029, whose text carries the values) a
   * line is done when the blank is gone from the latest version (REQ-026 FR-4).
   */
  facts?: Readonly<Record<string, string>>;
  templateSet?: boolean;
  tradingName: string;
  pathway: "verification" | "certification";
  result: Pick<QuestionnaireResult, "registers">;
  documents: SheetDocumentInput[];
  /** True when the registers subscription is active, so the registers live in the app. */
  subscribed: boolean;
  generatedAt: string;
  summaryVersion: string;
};

export type FillLine = {
  section: string;
  heading: string;
  blank: string;
  /** "Section 2, Scope: [name]" */
  text: string;
  done: boolean;
  /** REQ-029 FR-4: the words after an open line ("Fill this in on your details page", "Fills in when you adopt this document"); null when done. */
  note: string | null;
};

export type SectionLine = { section: string; heading: string; text: string };

export type SheetDocument = {
  n: number;
  typeId: string;
  title: string;
  file: string;
  minutes: number;
  fillIn: FillLine[];
  fillInWord: FillLine[];
  /** REQ-029 FR-4 (D-2854, D-2855): the approver and date blanks, which fill on adoption; empty on an older set whose text carries them. */
  fillsOnAdoption: FillLine[];
  review: SectionLine[];
  makeYours: SectionLine[];
  /** "Read once: fixed text in sections 1, 3 to 5." or null when nothing is fixed. */
  readOnce: string | null;
  adopted: boolean;
};

export type StartHereSheet = {
  tradingName: string;
  generatedAt: string;
  summaryVersion: string;
  oneMinute: string[];
  /** FR-3: "You have N things to fill in across M documents". */
  counts: {
    toFill: number;
    done: number;
    documents: number;
    registers: number;
  };
  firstSteps: { n: number; title: string; why: string }[];
  documents: SheetDocument[];
  registers: { title: string; purpose: string; where: string }[];
  next: { text: string; href: string }[];
  /** The audit words the sheet uses, each with its glossary meaning (REQ-025 AC-8 on generated text). */
  words: { term: string; meaning: string }[];
};

/** "1, 3 to 5, 8" from [1, 3, 4, 5, 8]. */
export function compressNumbers(numbers: readonly string[]): string {
  const n = numbers
    .map((x) => Number(x))
    .filter((x) => Number.isFinite(x))
    .sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < n.length; i += 1) {
    let j = i;
    while (j + 1 < n.length && n[j + 1] === n[j] + 1) j += 1;
    parts.push(
      j > i + 1
        ? `${n[i]} to ${n[j]}`
        : j === i + 1
          ? `${n[i]}, ${n[j]}`
          : `${n[i]}`,
    );
    i = j;
  }
  return parts.join(", ");
}

const sectionWord = (number: string, heading: string) =>
  number ? `Section ${number}, ${heading}` : heading;

function fillLine(
  b: DocumentBlank,
  latest: DocumentBlank[],
  rule: { facts: Readonly<Record<string, string>>; templateSet: boolean },
  note: string,
): FillLine {
  const key = formFactKeyFor(b.blank);
  const done = rule.templateSet
    ? Boolean(key && rule.facts[key]?.trim())
    : !latest.some(
        (x) => x.sectionNumber === b.sectionNumber && x.blank === b.blank,
      );
  return {
    section: b.sectionNumber,
    heading: b.sectionHeading,
    blank: b.blank,
    text: `${sectionWord(b.sectionNumber, b.sectionHeading)}: ${b.blank}`,
    done,
    note: done ? null : note,
  };
}

/** The approver's name and role and the approval date: account facts the adoption snapshot fills (D-2855). */
function isAdoptionBlank(blank: string): boolean {
  const key = factKeyFor(blank);
  return key !== null && isAccountFactKey(key);
}

/**
 * REQ-029 FR-9 (D-2861): a set made from this REQ on keeps its brackets, so
 * its control table's Approver cell still reads "[name], [role]"; a set made
 * before had the values written into its text. Read from the latest models.
 */
export function isTemplateSet(latest: readonly DocumentModel[]): boolean {
  const cells = latest.flatMap((m) =>
    m.sections
      .filter((s) => s.id === "document-control")
      .flatMap((s) => s.blocks)
      .flatMap((b) => (b.type === "table" ? b.rows : []))
      .filter((r) => r[0] === "Approver")
      .map((r) => r[1] ?? ""),
  );
  return cells.length === 0 || cells.every((c) => c.includes("[name]"));
}

/** The blanks the app never sees: not a Finish-form fact and not an account fact (the signature and date lines, the register row templates). */
function isWordBlank(blank: string): boolean {
  if (formFactKeyFor(blank) !== null) return false;
  const key = factKeyFor(blank);
  return key === null || !isAccountFactKey(key);
}

function dedupe(lines: FillLine[]): FillLine[] {
  const seen = new Set<string>();
  return lines.filter((l) => {
    const k = `${l.section}|${l.blank}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function sectionLines(
  model: DocumentModel,
  pick: (s: ResolvedSection) => boolean,
): SectionLine[] {
  return model.sections
    .filter((s) => s.number && pick(s))
    .map((s) => ({
      section: s.number,
      heading: s.heading,
      text: sectionWord(s.number, s.heading),
    }));
}

/**
 * The blanks a provider fills, by section: a section still a placeholder
 * (never shipped, FR-0c) carries the brief's own brackets, not a blank, so
 * it is left out; its heading goes to "Make it yours" instead.
 */
export function sheetBlanks(model: DocumentModel): DocumentBlank[] {
  const shipped: DocumentModel = {
    ...model,
    sections: model.sections.filter((s) => s.status !== "placeholder"),
  };
  return collectBlanks(shipped);
}

export function buildStartHere(input: StartHereInput): StartHereSheet {
  const c = startHereContent;
  const order = auditOrder(input.documents.map((d) => d.typeId));
  const docs = [...input.documents].sort(
    (a, b) => order.indexOf(a.typeId) - order.indexOf(b.typeId),
  );
  const rule = {
    facts: input.facts ?? {},
    templateSet: input.templateSet ?? false,
  };
  const documents: SheetDocument[] = docs.map((d, i) => {
    const originalBlanks = sheetBlanks(d.original);
    const latestBlanks = sheetBlanks(d.latest);
    const fillIn = dedupe(
      originalBlanks
        .filter((b) => formFactKeyFor(b.blank) !== null)
        .map((b) => fillLine(b, latestBlanks, rule, c.fillOpenLine)),
    );
    const fillInWord = dedupe(
      originalBlanks
        .filter((b) => isWordBlank(b.blank))
        .map((b) => ({
          ...fillLine(b, latestBlanks, rule, c.fillOpenLine),
          done: false,
          note: null,
        })),
    );
    // REQ-029 FR-4: the approver and date lines, once per blank, done on adoption.
    const fillsOnAdoption = rule.templateSet
      ? dedupe(
          originalBlanks
            .filter((b) => isAdoptionBlank(b.blank))
            .map((b) => ({
              section: "",
              heading: "",
              blank: b.blank,
              text: `Approval line: ${b.blank}`,
              done: d.adopted,
              note: d.adopted ? null : c.fillAdoptionLine,
            })),
        )
      : [];
    const fixed = d.latest.sections
      .filter((s) => s.number && s.status === "fixed")
      .map((s) => s.number);
    return {
      n: i + 1,
      typeId: d.typeId,
      title: d.latest.title,
      file: `${d.typeId}.docx`,
      minutes: c.estimatesMinutes[d.typeId] ?? c.defaultMinutes,
      fillIn,
      fillInWord,
      fillsOnAdoption,
      review: sectionLines(d.latest, (s) => s.status === "generated"),
      makeYours: sectionLines(
        d.latest,
        (s) => s.status === "fallback" || s.status === "placeholder",
      ),
      readOnce: fixed.length
        ? `Read once: fixed text in ${fixed.length === 1 ? "section" : "sections"} ${compressNumbers(fixed)}.`
        : null,
      adopted: d.adopted,
    };
  });
  const toFill = documents.reduce((n, d) => n + d.fillIn.length, 0);
  const done = documents.reduce(
    (n, d) => n + d.fillIn.filter((l) => l.done).length,
    0,
  );
  const withBlanks = documents.filter((d) => d.fillIn.length > 0).length;
  const firstGroup = orderDocuments(
    docs.map((d) => ({ document_type_id: d.typeId })),
  )[0];
  const firstSteps = (firstGroup?.documents ?? []).map((d, i) => {
    const doc = documents.find((x) => x.typeId === d.document_type_id)!;
    return {
      n: i + 1,
      title: doc.title,
      why: c.firstWhy[d.document_type_id] ?? c.defaultFirstWhy,
    };
  });
  const audit = `${input.pathway}-audit`;
  const registers = input.result.registers.map((r) => {
    const inPack = docs.find((d) =>
      (c.registerDocuments[r.id] ?? []).includes(d.typeId),
    );
    const where = input.subscribed
      ? `in the app, under Registers`
      : inPack
        ? `the template in your ${inPack.latest.title}`
        : `your own register until you subscribe`;
    return {
      title: r.title,
      purpose: c.registerPurpose[r.id] ?? "What an auditor samples.",
      where: `Where: ${where}.`,
    };
  });
  const oneMinute = [
    `Your audit: ${input.pathway} (${glossaryMeaning(audit)}).`,
    `${documents.length} documents and ${registers.length} registers.`,
    "A document counts when it is filled in, read, and adopted.",
    `About how long: ${c.estimateLine}`,
    "The owner's name, role and the approval date fill in from your account and on adoption.",
    'If a blank does not apply to you, write "not applicable" and why; do not delete the line.',
  ];
  const sheet: StartHereSheet = {
    tradingName: input.tradingName,
    generatedAt: input.generatedAt,
    summaryVersion: input.summaryVersion,
    oneMinute,
    counts: {
      toFill,
      done,
      documents: withBlanks,
      registers: registers.length,
    },
    firstSteps,
    documents,
    registers,
    next: c.next,
    words: [],
  };
  // Every glossary term the sheet uses gets its meaning on the sheet (the audit kind's is in line one already).
  const text = sheetLines(sheet).join("\n").toLowerCase();
  sheet.words = glossaryContent.items
    .filter(
      (t) =>
        t.id !== `${input.pathway}-audit` &&
        text.includes(t.term.toLowerCase()),
    )
    .map((t) => ({ term: t.term, meaning: t.meaning }));
  return sheet;
}

/** FR-3's top line. */
export function countsLine(c: StartHereSheet["counts"]): string {
  const left = c.toFill - c.done;
  if (c.toFill === 0) return "Nothing to fill in: every blank is filled.";
  if (left === 0) return `All ${c.toFill} things to fill in are done.`;
  return `You have ${left} ${left === 1 ? "thing" : "things"} to fill in across ${c.documents} ${c.documents === 1 ? "document" : "documents"}.`;
}

/** Per document: "3 to fill in, 2 to review". */
export function documentCountsLine(d: SheetDocument): string {
  const left = d.fillIn.filter((l) => !l.done).length;
  return `${left} to fill in, ${d.review.length} to review`;
}

function section(
  number: string,
  heading: string,
  blocks: Block[],
): ResolvedSection {
  return {
    id: `start-here-${number}`,
    number,
    heading,
    mode: "fixed",
    status: "fixed",
    blocks,
  };
}

/** Every line of the sheet as the Word file prints them, a box before each line the provider ticks. */
/** A Fill in line as printed: ticked when done, the note after an open one (REQ-029 FR-4). */
export function fillInLine(l: FillLine): string {
  return `${l.done ? TICK : BOX}Fill in: ${l.text}${l.note ? `. ${l.note}.` : ""}`;
}

/** An approver or date line as printed (REQ-029 FR-4): ticked once adopted. */
export function adoptionFillLine(l: FillLine): string {
  return `${l.done ? TICK : BOX}${l.text}${l.note ? `. ${l.note}.` : ""}`;
}

export function sheetLines(sheet: StartHereSheet): string[] {
  const out: string[] = [];
  const push = (s: string) => out.push(s);
  sheet.oneMinute.forEach(push);
  sheet.words.forEach((w) => push(`${w.term}: ${w.meaning}.`));
  push(countsLine(sheet.counts));
  sheet.firstSteps.forEach((f) => push(`${f.n}. ${f.title}: ${f.why}`));
  for (const d of sheet.documents) {
    push(
      `${d.n}. ${d.title} (about ${d.minutes} minutes; ${documentCountsLine(d)})`,
    );
    push(`Open: ${d.file}`);
    d.fillIn.forEach((l) => push(fillInLine(l)));
    d.fillsOnAdoption.forEach((l) => push(adoptionFillLine(l)));
    d.fillInWord.forEach((l) =>
      push(`${BOX}Fill in Word: ${l.text} (fill this in Word)`),
    );
    d.review.forEach((l) => push(`${BOX}Review: ${l.text}`));
    d.makeYours.forEach((l) =>
      push(`${BOX}Make it yours: ${l.text} (generic text: add your details)`),
    );
    if (d.readOnce) push(d.readOnce);
    push(adoptLine(d.adopted));
  }
  sheet.registers.forEach((r) => {
    push(`${r.title}: ${r.purpose}`);
    push(r.where);
  });
  sheet.next.forEach((n) => push(`${n.text}: ${n.href}`));
  return out;
}

/** The sheet as a DocumentModel for the Word file: five numbered sections, steps and bullets, nothing from the model. */
export function startHereModel(
  sheet: StartHereSheet,
  facts: DocumentModel["facts"],
): DocumentModel {
  const sections: ResolvedSection[] = [
    section("1", "Your pack in one minute", [
      { type: "bullets", items: sheet.oneMinute },
      ...(sheet.words.length
        ? [
            {
              type: "bullets" as const,
              items: sheet.words.map((w) => `${w.term}: ${w.meaning}.`),
            },
          ]
        : []),
      { type: "paragraph", text: countsLine(sheet.counts) },
    ]),
    section("2", "Do these first", [
      {
        type: "steps",
        items: sheet.firstSteps.map((f) => `${f.title}: ${f.why}`),
      },
    ]),
    section("3", "For each document", [
      ...sheet.documents.flatMap((d): Block[] => [
        {
          type: "paragraph",
          text: `${d.n}. ${d.title} (about ${d.minutes} minutes; ${documentCountsLine(d)})`,
        },
        {
          type: "bullets",
          items: [
            `Open: ${d.file}`,
            ...d.fillIn.map(fillInLine),
            ...d.fillsOnAdoption.map(adoptionFillLine),
            ...d.fillInWord.map(
              (l) => `${BOX}Fill in Word: ${l.text} (fill this in Word)`,
            ),
            ...d.review.map((l) => `${BOX}Review: ${l.text}`),
            ...d.makeYours.map(
              (l) =>
                `${BOX}Make it yours: ${l.text} (generic text: add your details)`,
            ),
            ...(d.readOnce ? [d.readOnce] : []),
            adoptLine(d.adopted),
          ],
        },
      ]),
    ]),
    section("4", "Registers", [
      {
        type: "bullets",
        items: sheet.registers.flatMap((r) => [
          `${r.title}: ${r.purpose}`,
          r.where,
        ]),
      },
    ]),
    section("5", "When you are done", [
      {
        type: "steps",
        items: sheet.next.map((n) => `${n.text}: ${n.href}`),
      },
    ]),
  ];
  return {
    typeId: "start-here",
    title: START_HERE_TITLE,
    kind: "plan",
    version: sheet.summaryVersion,
    generatedAt: sheet.generatedAt,
    reviewDueAt: sheet.generatedAt,
    facts,
    sections,
    // FR-5: the generation date and the readiness summary's version, no ids.
    footer: `Generated ${sheet.generatedAt}; readiness summary version ${sheet.summaryVersion}`,
  };
}
