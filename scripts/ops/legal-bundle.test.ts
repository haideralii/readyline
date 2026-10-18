// @vitest-environment node
/**
 * The lawyer's bundle (REQ-022 FR-11, AC-6): the index lists the entries in
 * FR-11's order, each with its URL and date, the FR-12 questions at its head,
 * and no string from the fixture accounts' addresses. The whole build runs
 * here against the repository with a stubbed clock and a stubbed git date.
 */
import { describe, expect, it } from "vitest";
import {
  LEGAL_PAGES,
  TEMPLATE_NAMES,
  VENDOR_TERMS,
  collect,
  fixtureAddresses,
  formatDate,
  indexFileName,
  parseFrontMatter,
  questionLines,
  renderIndex,
  sectionParagraphs,
  sydneyToday,
} from "./legal-bundle-lib.mjs";

const BASE = "https://readyline.example.invalid";
const data = collect(process.cwd(), { lastChanged: () => "2026-10-17" });
const index = renderIndex({
  date: "2026-10-18",
  base: BASE,
  vendorReadOn: "2026-10-18",
  data,
});

describe("legal-bundle helpers", () => {
  it("formats a date in words, parses front matter and names the index file the vendor-terms reader expects", () => {
    expect(formatDate("2026-10-18")).toBe("18 October 2026");
    expect(formatDate("2026-01-05")).toBe("5 January 2026");
    expect(formatDate("unknown")).toBe("unknown");
    expect(
      parseFrontMatter(
        "---\ntitle: Terms of use\nupdated: 2026-10-16\n---\n# T\n",
      ).data,
    ).toEqual({ title: "Terms of use", updated: "2026-10-16" });
    expect(indexFileName("2026-10-18")).toBe("legal-bundle-2026-10-18.md");
    expect(indexFileName("2026-10-18")).toMatch(
      /^legal-bundle-(\d{4}-\d{2}-\d{2})\.md$/,
    );
  });

  it("dates the index where the business is: late evening UTC is the next day in Sydney", () => {
    expect(sydneyToday(new Date("2026-10-18T14:30:00Z"))).toBe("2026-10-19");
    expect(sydneyToday(new Date("2026-10-18T02:00:00Z"))).toBe("2026-10-18");
  });

  it("reads the questions as the text before the role's answer, under their headings", () => {
    const md =
      "## 1. Refunds\n\n2.1 Is the buyer a consumer? Read: yes. [ACL] s 3.\n\n2.2 Two part question; with a semicolon? Read: no.\n\n## 2. Other\n\nNot a question line.\n";
    expect(questionLines(md)).toEqual([
      {
        number: "2.1",
        question: "Is the buyer a consumer?",
        heading: "1. Refunds",
      },
      {
        number: "2.2",
        question: "Two part question; with a semicolon?",
        heading: "1. Refunds",
      },
    ]);
  });

  it("takes the paragraphs under the named sections only", () => {
    const md = "# R\n\n## A\n\none\n\n## B\n\ntwo\n\n## C\n\nthree\n";
    expect(sectionParagraphs(md, ["A", "C"])).toEqual(["one", "three"]);
  });

  it("finds the fixture accounts' addresses and nothing else", () => {
    expect(
      fixtureAddresses(
        "Write to owner@example.test or sam.worker@example.test, never hello@example.com twice: hello@example.com; a@readyline.example too.",
      ),
    ).toEqual([
      "owner@example.test",
      "sam.worker@example.test",
      "hello@example.com",
      "a@readyline.example",
    ]);
    expect(fixtureAddresses("No address here. ABN 51 824 753 556.")).toEqual(
      [],
    );
  });
});

describe("the index built from this repository (AC-6)", () => {
  it("lists the entries in FR-11's order, each with its URL or committed path and its date", () => {
    const order = [
      ...LEGAL_PAGES.map(
        (p) => `${BASE}${p.path} (source \`product/legal/${p.slug}.md\`)`,
      ),
      "**The AI and digital tools appendix.**",
      `**${VENDOR_TERMS.title}.** ${VENDOR_TERMS.url}`,
      `**The refund promise as it appears on /pricing and /documents.** ${BASE}/pricing`,
      `**The pricing page.** ${BASE}/pricing`,
      `**The sign-in screen.** ${BASE}/sign-in`,
      `**The account-setup screen.** ${BASE}/account/setup`,
      "**The worker invitation and reminder email templates.** `src/server/email/templates.ts`",
      "**One generated sole-trader document set.** `product/evidence/req-005/sole-trader/`",
    ];
    let at = -1;
    for (const needle of order) {
      const i = index.indexOf(needle, at + 1);
      expect(i, needle).toBeGreaterThan(at);
      at = i;
    }
    // Thirteen numbered entries, each closed by a date.
    const entries =
      index.match(/^\d+\. \*\*.*\*\* .* Last updated: .+\.$/gm) ?? [];
    expect(entries).toHaveLength(13);
    for (const e of entries) expect(e).not.toMatch(/Last updated: \.$/);
    // The pages carry their front-matter dates; the code surfaces the stubbed git date.
    expect(index).toContain(
      `${BASE}/terms (source \`product/legal/terms.md\`). Last updated: ${formatDate(data.legalPages[0].updated)}.`,
    );
    expect(data.legalPages[0].updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(index).toContain("Last updated: 17 October 2026.");
    for (const name of TEMPLATE_NAMES) expect(index).toContain(`\`${name}\``);
    expect(data.documentSet.files.length).toBeGreaterThanOrEqual(16);
    expect(index).toContain("`practice-standards-self-assessment.docx`");
  });

  it("puts the FR-12 questions at its head, from the product owner's file, before the bundle", () => {
    expect(data.questions.items.length).toBeGreaterThanOrEqual(20);
    const head = index.indexOf("## Questions for the lawyer (FR-12)");
    const bundle = index.indexOf("## The bundle, in order");
    expect(head).toBeGreaterThan(0);
    expect(bundle).toBeGreaterThan(head);
    expect(index).toContain("`product/legal/questions-for-the-lawyer.md`");
    for (const q of data.questions.items.slice(0, 5)) {
      const i = index.indexOf(`${q.number} ${q.question}`);
      expect(i, q.number).toBeGreaterThan(head);
      expect(i, q.number).toBeLessThan(bundle);
      expect(q.question).not.toContain("Read:");
    }
  });

  it("quotes the vendor's terms as read, with the read date, and the refund promise's paragraphs verbatim", () => {
    expect(index).toContain(`read on 18 October 2026`);
    expect(index).toContain(VENDOR_TERMS.clause);
    expect(data.refund.paragraphs.length).toBeGreaterThanOrEqual(2);
    for (const p of data.refund.paragraphs) expect(index).toContain(`> ${p}`);
  });

  it("without a base, the entries carry the site paths and the head says how to add the domain", () => {
    const paths = renderIndex({
      date: "2026-10-18",
      base: null,
      vendorReadOn: "2026-10-18",
      data,
    });
    expect(paths).toContain("**Terms of use.** /terms (source");
    expect(paths).toContain("rebuild with `--base https://<domain>`");
    expect(index).not.toContain("rebuild with");
  });

  it("carries no fixture address, no unfilled token and no claim words (AC-6; CLAUDE.md 4.3)", () => {
    expect(fixtureAddresses(index)).toEqual([]);
    expect(index).not.toMatch(/\{\{|\}\}|\[insert/i);
    // The index's own words, after the quoted questions (one of which quotes the AI page's "does not guarantee").
    const own = index.slice(index.indexOf("## The bundle, in order"));
    expect(own).not.toMatch(/guarantee|audit-proof|100%|approved by/i);
    expect(index).toContain("not legal advice");
  });
});
