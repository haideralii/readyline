// @vitest-environment node
/**
 * REQ-026 AC-1, AC-2 and AC-4 over the reference cases: the sheet lists
 * every document in the pack's own order, its "Fill in" lines are exactly
 * the Finish-form blanks of the shipped version, a blank filled through
 * Finish ticks and the counts move, the Word-only blanks sit in their own
 * bucket with the printed box, every line is at most 20 words with every
 * glossary term's meaning present, the Word file renders through the
 * shared renderer, and the content file covers every live document type.
 * With EVIDENCE=1 the sole-trader sheet is written under
 * product/evidence/req-026/.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import { lintText } from "@/lib/copy-lint/rules";
import { glossaryContent, startHereContent } from "@/lib/questionnaire/content";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { catalogue, documentTypeById } from "./catalogue";
import { buildSkeleton, type DocumentModel } from "./document-model";
import { buildProviderFacts } from "./facts";
import { applyFacts, formBlanks } from "./facts-fill";
import { loadReferenceCases } from "./reference-cases";
import { renderDocx } from "./render-docx";
import { auditOrder } from "./set-order";
import {
  BOX,
  START_HERE_FILE,
  buildStartHere,
  compressNumbers,
  countsLine,
  sheetBlanks,
  sheetLines,
  startHereModel,
  type StartHereInput,
} from "./start-here";

const dataset = getStandardsDataset();
const cases = loadReferenceCases();

function pack(caseId: string): {
  input: StartHereInput;
  models: Map<string, DocumentModel>;
} {
  const c = cases.find((x) => x.id === caseId)!;
  const facts = buildProviderFacts(c.answers, c.result);
  const models = new Map<string, DocumentModel>();
  for (const d of c.result.documents) {
    const type = documentTypeById(d.id)!;
    models.set(
      d.id,
      buildSkeleton({
        type,
        facts,
        dataset,
        result: c.result,
        version: "1",
        generatedAt: "2026-10-15",
      }),
    );
  }
  return {
    models,
    input: {
      tradingName: facts.tradingName,
      pathway: c.result.pathway,
      result: c.result,
      documents: [...models.entries()].map(([typeId, model]) => ({
        typeId,
        original: model,
        latest: model,
        adopted: false,
      })),
      subscribed: false,
      generatedAt: "2026-10-15",
      summaryVersion: "1",
    },
  };
}

const words = (s: string) => s.trim().split(/\s+/).length;

describe("the Start here sheet (REQ-026)", () => {
  it("AC-1: every document in the pack's order; the Fill in lines are the Finish-form blanks, counted the same way", () => {
    const { input, models } = pack("verification-sole-trader");
    const sheet = buildStartHere(input);
    expect(sheet.documents.map((d) => d.typeId)).toEqual(
      auditOrder([...models.keys()]),
    );
    expect(sheet.documents.map((d) => d.n)).toEqual(
      sheet.documents.map((_, i) => i + 1),
    );
    const expected = formBlanks(
      [...models.values()].flatMap((m) => sheetBlanks(m)),
    );
    const onSheet = sheet.documents.flatMap((d) => d.fillIn);
    expect(onSheet.length).toBe(expected.length);
    expect(sheet.counts.toFill).toBe(expected.length);
    expect(onSheet.every((l) => !l.done)).toBe(true);
    for (const d of sheet.documents) {
      expect(d.file).toBe(`${d.typeId}.docx`);
      expect(d.minutes).toBeGreaterThan(0);
      expect(d.readOnce).toMatch(/^Read once: fixed text in section/);
    }
    // The privacy policy carries the three form blanks the REQ names.
    const privacy = sheet.documents.find(
      (d) => d.typeId === "privacy-and-information-management-policy",
    )!;
    expect(privacy.fillIn.map((l) => l.blank)).toEqual([
      "[other tool]",
      "[allowed use]",
      "[limits]",
    ]);
    expect(privacy.fillIn[0].text).toMatch(
      /^(Section \d+, )?.+: \[other tool\]$/,
    );
    // The signature line is a Word blank, never a Finish line; account facts are in neither.
    const all = sheet.documents.flatMap((d) => [...d.fillIn, ...d.fillInWord]);
    expect(all.some((l) => /\[name\]|\[date\]/i.test(l.blank))).toBe(false);
    expect(
      sheet.documents.some((d) => d.fillInWord.length > 0),
      "some Word-only blank exists",
    ).toBe(true);
    expect(sheet.firstSteps.length).toBeGreaterThan(3);
    for (const f of sheet.firstSteps)
      expect(words(f.why)).toBeLessThanOrEqual(6);
    expect(sheet.registers.length).toBe(input.result.registers.length);
    expect(countsLine(sheet.counts)).toMatch(
      /^You have \d+ things to fill in across \d+ documents\.$/,
    );
  });

  it("AC-2: two of the privacy policy's three blanks filled through Finish leave one open line and the counts move", () => {
    const { input, models } = pack("verification-sole-trader");
    const typeId = "privacy-and-information-management-policy";
    const latest = applyFacts(models.get(typeId)!, {
      "other-tool": "Microsoft 365",
      "allowed-use": "rostering and invoices",
    });
    const sheet = buildStartHere({
      ...input,
      documents: input.documents.map((d) =>
        d.typeId === typeId ? { ...d, latest, adopted: true } : d,
      ),
    });
    const before = buildStartHere(input);
    const privacy = sheet.documents.find((d) => d.typeId === typeId)!;
    expect(privacy.fillIn.map((l) => l.done)).toEqual([true, true, false]);
    expect(privacy.adopted).toBe(true);
    expect(sheet.counts.done).toBe(before.counts.done + 2);
    expect(sheet.counts.toFill).toBe(before.counts.toFill);
    expect(countsLine(sheet.counts)).toContain(
      `You have ${sheet.counts.toFill - 2} things to fill in`,
    );
    // Every line of a fully finished pack reads done.
    const finished = buildStartHere({
      ...input,
      documents: input.documents.map((d) => ({
        ...d,
        latest: { ...d.latest, sections: [] },
        adopted: true,
      })),
    });
    expect(finished.counts.done).toBe(finished.counts.toFill);
    expect(countsLine(finished.counts)).toMatch(
      /^All \d+ things to fill in are done\.$/,
    );
  });

  it("AC-4: every line is at most 20 words, claim-free, lint-clean, and every glossary term present has its meaning", () => {
    for (const c of cases) {
      const { input } = pack(c.id);
      const sheet = buildStartHere(input);
      const lines = sheetLines(sheet);
      expect(lines.length).toBeGreaterThan(40);
      for (const line of lines) {
        const bare = line.replace(BOX, "");
        expect(words(bare), `${c.id}: "${bare}"`).toBeLessThanOrEqual(20);
        expect(findProhibitedClaims(bare), bare).toEqual([]);
        expect(
          lintText(bare).filter((v) => v.rule !== "internal-path"),
          bare,
        ).toEqual([]);
      }
      const text = lines.join("\n").toLowerCase();
      for (const t of glossaryContent.items)
        if (text.includes(t.term.toLowerCase()))
          expect(text, `${c.id}: meaning of "${t.term}"`).toContain(
            t.meaning.toLowerCase(),
          );
    }
  });

  it("renders as a Word file through the shared renderer, first in the zip by name, with the date and the summary version in the footer", async () => {
    const { input } = pack("verification-sole-trader");
    const sheet = buildStartHere(input);
    const model = startHereModel(sheet, input.documents[0].original.facts);
    expect(model.title).toBe("Start here");
    expect(model.sections.map((s) => s.number)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
    ]);
    expect(model.footer).toBe(
      "Generated 2026-10-15; readiness summary version 1",
    );
    expect(model.footer).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/);
    expect(START_HERE_FILE < "governance-policy.docx").toBe(true);
    expect(START_HERE_FILE).toMatch(/^[a-z0-9][a-z0-9.-]{0,120}\.docx$/);
    const docx = await renderDocx(model);
    expect(docx.length).toBeGreaterThan(5_000);
    if (process.env.EVIDENCE) {
      mkdirSync("product/evidence/req-026", { recursive: true });
      writeFileSync(`product/evidence/req-026/${START_HERE_FILE}`, docx);
      writeFileSync(
        "product/evidence/req-026/start-here-sole-trader.txt",
        sheetLines(sheet).join("\n"),
      );
    }
  });

  it("the content file covers every live document type with an estimate, and the first-step reasons are six words or fewer", () => {
    for (const t of catalogue.items.filter((x) => !x.retired))
      expect(startHereContent.estimatesMinutes[t.id], t.id).toBeGreaterThan(0);
    for (const [id, why] of Object.entries(startHereContent.firstWhy)) {
      expect(documentTypeById(id), id).toBeDefined();
      expect(words(why), why).toBeLessThanOrEqual(6);
    }
    for (const ids of Object.values(startHereContent.registerDocuments))
      for (const id of ids) expect(documentTypeById(id), id).toBeDefined();
    expect(compressNumbers(["1", "3", "4", "5", "8", "10", "11"])).toBe(
      "1, 3 to 5, 8, 10, 11",
    );
    expect(compressNumbers([])).toBe("");
  });

  it("REQ-031 AC-9 (FR-4; D-2889): section 5 holds exactly three steps, the checklist, the audit day, then the systems check", () => {
    const { input } = pack("verification-sole-trader");
    const sheet = buildStartHere(input);
    expect(sheet.next).toEqual([
      { text: "Tick off your readiness checklist", href: "/checklist" },
      {
        text: "See what the auditor asks for on the day",
        href: "/path/audit-day",
      },
      {
        text: "Check your systems before the audit",
        href: "/path/audit-day/check",
      },
    ]);
    // The Word file's section 5 carries the same three, in order.
    const model = startHereModel(sheet, input.documents[0].original.facts);
    const five = model.sections.find((s) => s.number === "5")!;
    const items = five.blocks.flatMap((b) =>
      b.type === "steps" ? b.items : [],
    );
    expect(items).toEqual(sheet.next.map((n) => `${n.text}: ${n.href}`));
  });
});
