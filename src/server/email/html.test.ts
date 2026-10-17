import { describe, expect, it } from "vitest";
import { inlineHtml, renderHtml } from "./html";

const ORIGIN = "https://readyline.example";

describe("the HTML alternative (REQ-022 FR-7)", () => {
  it("renders paragraphs and a list from the text, escaped", () => {
    const html = renderHtml(
      "Reminders for Sunrise & Co:\n\n- Policy review PR-1 due 1 Nov\n- Insurance I-2 <soon>\n\nSign in and open Registers.",
      ORIGIN,
    );
    expect(html).toContain("<p>Reminders for Sunrise &amp; Co:</p>");
    expect(html).toContain(
      "<ul><li>Policy review PR-1 due 1 Nov</li><li>Insurance I-2 &lt;soon&gt;</li></ul>",
    );
    expect(html).toContain("<p>Sign in and open Registers.</p>");
    expect(html).toMatch(/^<!doctype html>/);
  });

  it("links a URL under the site's origin and leaves every other URL as text", () => {
    const line = inlineHtml(
      `Open ${ORIGIN}/registers or read https://elsewhere.example/x.`,
      ORIGIN,
    );
    expect(line).toContain(
      `<a href="${ORIGIN}/registers">${ORIGIN}/registers</a> or`,
    );
    expect(line).toContain("read https://elsewhere.example/x.");
    expect(line).not.toContain('href="https://elsewhere');
  });

  it("carries no image, no style and no script", () => {
    const html = renderHtml("Hello <img src=x> world", ORIGIN);
    expect(html).not.toMatch(/<img|<style|<script|style=/);
    expect(html).toContain("&lt;img src=x&gt;");
  });
});
