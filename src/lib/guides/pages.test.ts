import { describe, expect, it } from "vitest";
import { registrationGroupsTable } from "./groups-table";
import { loadGuide, loadGuides, parseFaq, parseSources } from "./pages";
import { getStandardsDataset } from "@/lib/standards/dataset";

describe("guides (REQ-011)", () => {
  it("loads the four guides with valid front matter, six FAQ entries each and sources", () => {
    const guides = loadGuides();
    expect(guides.map((g) => g.slug)).toEqual([
      "ndis-registration-cost",
      "registers-an-auditor-asks-for",
      "what-happens-at-an-ndis-audit",
      "which-ndis-audit",
    ]);
    for (const g of guides) {
      expect(g.title.length).toBeGreaterThan(10);
      expect(g.description.length).toBeGreaterThanOrEqual(40);
      expect(g.faq).toHaveLength(6);
      expect(g.sources.length).toBeGreaterThanOrEqual(3);
      expect(g.markdown).not.toMatch(/^## FAQ/m);
      expect(g.markdown).not.toMatch(/^## Sources/m);
      expect(g.markdown).not.toMatch(/^# /m);
    }
  });

  it("lists the UNVERIFIED lines for the PO", () => {
    // Batch 35 (NDIS watch item A12): the application-fee lines now carry the ABLIS citation and no marker.
    const cost = loadGuide("ndis-registration-cost");
    expect(cost.unverified.join("\n")).not.toMatch(/application/i);
    expect(cost.markdown).toMatch(/No application fee/);
    expect(cost.faq.map((f) => f.answer).join("\n")).toMatch(
      /does not charge an application fee/,
    );
    // The later compulsory-registration dates (item A11) were not approved and keep their marker;
    // the "add a service later" answer now cites the Commission's out-of-cycle audit (backlog 3).
    const audit = loadGuide("which-ndis-audit");
    expect(audit.unverified.length).toBeGreaterThanOrEqual(1);
    expect(audit.faq.map((f) => f.answer).join("\n")).toMatch(/out of cycle/);
    // The two new guides label the sector-webinar material as practice and cite the Commission.
    for (const slug of [
      "what-happens-at-an-ndis-audit",
      "registers-an-auditor-asks-for",
    ]) {
      const g = loadGuide(slug);
      // D-2003 (batch 45): published on the PO's decision, 15 Oct 2026.
      expect(g.draft).toBe(false);
      expect(
        g.sources.filter((s) => s.url?.includes("ndiscommission.gov.au"))
          .length,
      ).toBeGreaterThanOrEqual(2);
      expect(g.markdown).toMatch(/not a rule|not rules/);
    }
  });

  it("parses FAQ and sources blocks", () => {
    expect(
      parseFaq("\n### One?\n\nAnswer one.\n\n### Two?\n\nAnswer two.\n"),
    ).toEqual([
      { question: "One?", answer: "Answer one." },
      { question: "Two?", answer: "Answer two." },
    ]);
    expect(parseSources("- [A](https://a.example)\n- Plain note\n")).toEqual([
      { label: "A", url: "https://a.example" },
      { label: "Plain note", url: null },
    ]);
  });

  it("generates the registration groups table from the standards data", () => {
    const table = registrationGroupsTable(getStandardsDataset());
    expect(table).toMatch(/^\| Code \| Registration group \| Audit \|/);
    expect(table).toMatch(/\| 0120 \| household tasks \| verification/i);
    expect(table).toMatch(/\| 0107 \| .* \| certification/i);
    expect(table).toMatch(/38 groups: \d+ verification, \d+ certification\./);
    // The guide's placeholder is replaced at render time; the file never carries the table.
    expect(loadGuide("which-ndis-audit").markdown).toContain(
      "{{registration-groups-table}}",
    );
  });
});
