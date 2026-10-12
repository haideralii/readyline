// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  draftNote,
  formatUpdated,
  hasHandTypedNumbers,
  loadLegalPage,
  markdownToText,
  numberHeadings,
  parseFrontMatter,
  stripTitleHeading,
} from "./pages";

const tmp = mkdtempSync(join(tmpdir(), "readyline-legal-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function write(name: string, text: string) {
  writeFileSync(join(tmp, `${name}.md`), text);
}

describe("legal page loading (REQ-008 FR-1, AC-4)", () => {
  it("reads the front matter, drops the title heading and numbers the headings", () => {
    write(
      "terms",
      "---\ntitle: Terms of use\nupdated: 2026-10-12\nowner: po\nstatus: draft (checked by a lawyer before launch)\n---\n\n# Terms of use\n\n## What this is\n\nText.\n\n### Detail\n\n## Next\n",
    );
    const page = loadLegalPage("terms", tmp);
    expect(page.title).toBe("Terms of use");
    expect(page.updated).toBe("2026-10-12");
    expect(page.owner).toBe("po");
    expect(page.draft).toBe(true);
    expect(page.body.startsWith("# Terms of use")).toBe(true);
    expect(page.markdown).toBe(
      "## 1 What this is\n\nText.\n\n### 1.1 Detail\n\n## 2 Next\n",
    );
  });

  it("parses key: value front matter, with or without quotes and CRLF", () => {
    expect(
      parseFrontMatter(
        '---\r\ntitle: "Quoted title"\r\nupdated: 2026-10-12\r\nstatus: draft (note; with punctuation)\r\n---\r\n\r\nBody.\r\n',
      ),
    ).toEqual({
      data: {
        title: "Quoted title",
        updated: "2026-10-12",
        status: "draft (note; with punctuation)",
      },
      content: "\r\nBody.\r\n",
    });
    expect(parseFrontMatter("No front matter.\n")).toEqual({
      data: {},
      content: "No front matter.\n",
    });
  });

  it("accepts a quoted date and rejects a missing date or another owner", () => {
    write(
      "privacy",
      '---\ntitle: Privacy\nupdated: "2026-10-12"\nowner: po\n---\n\nBody.\n',
    );
    expect(loadLegalPage("privacy", tmp).updated).toBe("2026-10-12");
    expect(loadLegalPage("privacy", tmp).draft).toBe(false);
    write("refunds", "---\ntitle: Refunds\nowner: po\n---\n\nBody.\n");
    expect(() => loadLegalPage("refunds", tmp)).toThrow(/updated/);
    write(
      "ai",
      "---\ntitle: AI\nupdated: 2026-10-12\nowner: dev\n---\n\nBody.\n",
    );
    expect(() => loadLegalPage("ai", tmp)).toThrow(/owner/);
  });

  it("numbers from structure and detects hand-typed numbers", () => {
    expect(
      numberHeadings("## A\n### B\n### C\n## D\n```\n## not a heading\n```\n"),
    ).toBe(
      "## 1 A\n### 1.1 B\n### 1.2 C\n## 2 D\n```\n## not a heading\n```\n",
    );
    expect(hasHandTypedNumbers("## 1 Our promise\n")).toBe(true);
    expect(hasHandTypedNumbers("### 2.1 Detail\n")).toBe(true);
    expect(hasHandTypedNumbers("## Our promise\n## 14 days\n")).toBe(true);
    expect(hasHandTypedNumbers("## Our promise\n")).toBe(false);
    expect(stripTitleHeading("# Title\n\n## A\n")).toBe("## A\n");
  });

  it("flattens markdown to the text the readability score reads", () => {
    expect(
      markdownToText(
        "# Title\n\n## Heading\n\n- One **bold** item.\n- A [link](/x) here.\n\n| a | b |\n| - | - |\n\nPlain `code` text.\n",
      ),
    ).toBe("One bold item.\nA link here.\n\n\nPlain code text.");
  });

  it("formats the date and the draft note", () => {
    expect(formatUpdated("2026-10-12")).toBe("12 October 2026");
    expect(formatUpdated("2027-01-03")).toBe("3 January 2027");
    expect(draftNote(null)).toBeNull();
    expect(draftNote("final")).toBeNull();
    expect(draftNote("draft")).toBe("Draft.");
    expect(
      draftNote(
        "draft (plain-language draft by the product owner; to be checked by a lawyer before launch)",
      ),
    ).toBe(
      "Plain-language draft by the product owner; to be checked by a lawyer before launch.",
    );
  });
});
