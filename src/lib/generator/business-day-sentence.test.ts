// @vitest-environment node
/**
 * REQ-032 FR-7, AC-5 (D-2919): the plain-words meaning of a business day
 * sits once in the incident management policy and once in the safeguarding
 * policy, after the first sentence that counts five business days, and the
 * rendered Word file carries it once; no other document carries it.
 */
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { catalogue, documentTypeById } from "./catalogue";
import { buildSkeleton, type DocumentModel } from "./document-model";
import { buildProviderFacts } from "./facts";
import { BUSINESS_DAY_SENTENCE } from "./fixed-extras";
import { loadReferenceCases } from "./reference-cases";
import { renderDocx } from "./render-docx";

const dataset = getStandardsDataset();
const c = loadReferenceCases().find(
  (x) => x.id === "certification-personal-care",
)!;
const facts = buildProviderFacts(c.answers, c.result);

function model(typeId: string): DocumentModel {
  const type = documentTypeById(typeId)!;
  return buildSkeleton({
    type,
    facts,
    dataset,
    result: c.result,
    version: "1",
    generatedAt: "2026-10-18",
  });
}

const textOf = (m: DocumentModel) =>
  m.sections
    .flatMap((s) =>
      s.blocks.map((b) =>
        "text" in b
          ? String(b.text)
          : "items" in b
            ? (b.items as string[]).join("\n")
            : "rows" in b
              ? (b.rows as string[][]).flat().join("\n")
              : "",
      ),
    )
    .join("\n");

const count = (hay: string, needle: string) => hay.split(needle).length - 1;

describe("the business-day sentence in the documents (REQ-032 FR-7)", () => {
  it("reads the Acts Interpretation Act meaning in plain words", () => {
    expect(BUSINESS_DAY_SENTENCE).toBe(
      "A business day is not a Saturday, a Sunday or a public holiday in the state where we work.",
    );
  });

  it("sits once in the incident policy, after its first five-business-day sentence, and once in the rendered Word file", async () => {
    const m = model("incident-management-policy-and-register");
    const text = textOf(m);
    expect(count(text, BUSINESS_DAY_SENTENCE)).toBe(1);
    expect(text.indexOf("5 business days")).toBeGreaterThan(-1);
    expect(text.indexOf("5 business days")).toBeLessThan(
      text.indexOf(BUSINESS_DAY_SENTENCE),
    );
    const docx = await renderDocx(m);
    const xml = strFromU8(unzipSync(docx)["word/document.xml"]);
    expect(count(xml, BUSINESS_DAY_SENTENCE)).toBe(1);
  });

  it("sits once in the safeguarding policy and in no other document of the pack", () => {
    expect(
      count(textOf(model("safeguarding-policy")), BUSINESS_DAY_SENTENCE),
    ).toBe(1);
    const others = catalogue.items
      .filter((t) => !t.retired)
      .map((t) => t.id)
      .filter(
        (id) =>
          id !== "incident-management-policy-and-register" &&
          id !== "safeguarding-policy" &&
          c.result.documents.some((d) => d.id === id),
      );
    for (const id of others)
      expect(count(textOf(model(id)), BUSINESS_DAY_SENTENCE), id).toBe(0);
  });
});
