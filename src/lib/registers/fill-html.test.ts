import { describe, expect, it } from "vitest";
import { esc, refusalFormHtml } from "./fill-html";

/** REQ-024 FR-6b (findings 76, 123): the refused form keeps the typed values, escaped, and nothing else. */
describe("the refused fill form", () => {
  it("escapes what the owner typed and keeps it in the fields", () => {
    const html = refusalFormHtml({
      brand: "Readyline",
      message:
        "Tick the line about telling your workers before you download a filled file.",
      codes: ["W-001"],
      pastCodes: ["W-002"],
      supervisorRefs: ["W-007"],
      state: {
        fill: true,
        told: false,
        asAt: "2026-10-17",
        values: {
          workers: { "W-001": { full_name: 'Marked <b>"Value"</b>' } },
          supervisors: { "W-007": "Super Visor" },
          assessor_name: "Owner Name, director",
        },
      },
    });
    expect(html).toContain("Marked &#60;b&#62;&#34;Value&#34;&#60;/b&#62;");
    expect(html).not.toContain("<b>");
    expect(html).toContain('name="name:W-001"');
    expect(html).toContain("past worker");
    expect(html).toContain('value="Super Visor"');
    expect(html).toContain('value="Owner Name, director"');
    expect(html).toContain('data-testid="fill-told" required');
    expect(html).toContain(
      'http-equiv="refresh" content="600; url=/registers/staff-matrix/export"',
    );
    expect(html).not.toContain("<script");
    expect(html).toContain('formaction="/registers/staff/export/workers"');
  });

  it("escapes the five characters and leaves the rest", () => {
    expect(esc(`a&b<c>d"e'f`)).toBe("a&#38;b&#60;c&#62;d&#34;e&#39;f");
    expect(esc("W-001, Sydney")).toBe("W-001, Sydney");
  });
});
