import { expect, type Page } from "@playwright/test";
import {
  findGlossaryTerms,
  hasMeaning,
  stripGlossaryBrackets,
} from "@/lib/copy-lint/glossary";
import { glossaryTerm } from "@/lib/questionnaire/content";
import {
  GLOSSARY_ATTRIBUTION,
  GLOSSARY_BRACKET_TITLE,
} from "@/components/glossary-copy";
import {
  AI_DISCLOSURE,
  GENERAL_INFORMATION_NOTICE,
  GENERAL_INFORMATION_STATEMENT,
} from "@/lib/brand";
import { axeSerious } from "./a11y";

/** The three allow-listed constants (REQ-025 FR-10) are outside the check (finding 49), removed from the text before the match. */
function withoutAllowedConstants(text: string): string {
  let out = text.replace(/\s+/g, " ");
  for (const c of [
    AI_DISCLOSURE,
    GENERAL_INFORMATION_NOTICE,
    GENERAL_INFORMATION_STATEMENT,
  ])
    out = out.split(c.replace(/\s+/g, " ")).join(" ");
  return out;
}

/**
 * REQ-027 AC-3 (D-2710, D-2714, D-2719, D-2721, D-2724): the render check
 * one spec per page calls once the page has rendered. It reads the glossary
 * and the page, never a literal list of terms: every glossary term present
 * in `main` (text content and text attributes alike), outside the REQ-017
 * strip, the questionnaire's stepper (navigation chrome, not the page's
 * words), the disclosure's own `dl`, the bracket component's wrapper and a
 * token-resolved bracket's text, must have its meaning somewhere in `main`;
 * the disclosure, when shown, opens with D-2706's line, each `dd` reads the
 * meaning's sentence then `more`, its count equals the terms present (minus
 * the page's inline first term, the result page's audit kind), and a bracket
 * component carries D-2719's `title`. axe must report nothing serious. The
 * three allow-listed constants carry no glossary term, so no exemption is
 * coded for them. Returns the ids present, for the spec's own assertions.
 */
export async function glossaryOnPage(
  page: Page,
  options: {
    label?: string;
    /** The id the page gives inline as its first use (the result page's audit kind), left out of the disclosure's count. */
    inline?: string;
    /** Skip axe when the spec already ran it on this render. */
    axe?: boolean;
  } = {},
): Promise<string[]> {
  const label = options.label ?? page.url();
  const read = await page.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) return null;
    const clone = main.cloneNode(true) as HTMLElement;
    for (const sel of [
      '[data-testid="next-step"]',
      'nav[aria-label="Questionnaire steps"]',
      '[data-testid="glossary-terms"] dl',
      '[data-testid^="glossary-bracket-"]',
      "script",
      "style",
    ])
      for (const el of Array.from(clone.querySelectorAll(sel))) el.remove();
    const attrs: string[] = [];
    for (const el of Array.from(clone.querySelectorAll("*")))
      for (const a of ["title", "aria-label", "alt", "placeholder"]) {
        const v = el.getAttribute(a);
        if (v) attrs.push(v);
      }
    // Text nodes joined with a space: textContent glues adjacent elements
    // ("Complaints registerWorker screening clearance register"), which hides
    // a term at an element boundary from the whole-word match.
    const textOf = (root: Node) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const parts: string[] = [];
      let n: Node | null;
      while ((n = walker.nextNode())) parts.push(n.nodeValue ?? "");
      return parts.join(" ").replace(/\s+/g, " ");
    };
    const full = textOf(main);
    const text = `${textOf(clone)}\n${attrs.join("\n")}`;
    const disclosure = main.querySelector('[data-testid="glossary-terms"]');
    const summary =
      disclosure?.querySelector("summary")?.textContent?.trim() ?? null;
    const attribution =
      disclosure
        ?.querySelector('[data-testid="glossary-attribution"]')
        ?.textContent?.trim() ?? null;
    const dds = disclosure
      ? Array.from(disclosure.querySelectorAll("[data-testid^='glossary-']"))
          .filter(
            (d) => d.getAttribute("data-testid") !== "glossary-attribution",
          )
          .map((d) => ({
            id: (d.getAttribute("data-testid") ?? "").replace(/^glossary-/, ""),
            text: d.textContent?.replace(/\s+/g, " ").trim() ?? "",
          }))
      : [];
    const brackets = Array.from(
      main.querySelectorAll('[data-testid^="glossary-bracket-"]'),
    ).map((b) => ({
      id: (b.getAttribute("data-testid") ?? "").replace(
        /^glossary-bracket-/,
        "",
      ),
      title: b.getAttribute("title"),
      text: b.textContent ?? "",
    }));
    return { full, text, summary, attribution, dds, brackets };
  });
  expect(read, `${label}: the page has a main element`).not.toBeNull();
  const { full, text, summary, attribution, dds, brackets } = read!;
  const present = findGlossaryTerms(
    stripGlossaryBrackets(withoutAllowedConstants(text)),
  );
  const missing = present.filter((id) => !hasMeaning(full, id));
  expect(
    missing.map((id) => `${id} ("${glossaryTerm(id).term}")`),
    `${label}: glossary terms present without their meaning`,
  ).toEqual([]);
  for (const b of brackets) {
    expect(b.title, `${label}: bracket ${b.id} carries the attribution`).toBe(
      GLOSSARY_BRACKET_TITLE,
    );
    const t = glossaryTerm(b.id);
    expect(b.text.replace(/\s+/g, " ").trim()).toBe(`${t.term} (${t.meaning})`);
  }
  if (summary !== null) {
    const counted = present.filter((id) => id !== options.inline);
    expect(
      summary,
      `${label}: the disclosure's count (present on the page: ${counted.join(", ")}; listed: ${dds.map((d) => d.id).join(", ")})`,
    ).toBe(`What these words mean (${counted.length})`);
    // D-2852: the block carries no intro line.
    expect(
      attribution,
      `${label}: the disclosure carries no intro line`,
    ).toBeNull();
    expect(
      dds.map((d) => d.id).sort(),
      `${label}: the disclosure lists the terms present`,
    ).toEqual([...counted].sort());
    for (const d of dds) {
      const t = glossaryTerm(d.id);
      const sentence = `${t.meaning[0].toUpperCase()}${t.meaning.slice(1)}.`;
      expect(d.text, `${label}: ${d.id} reads its one sentence`).toBe(
        `${t.term}: ${sentence}`,
      );
    }
  } else {
    // No disclosure: at most one term, carried by a bracket or inline.
    expect(
      present.filter((id) => id !== options.inline).length,
      `${label}: a page without the disclosure shows one term at most (present: ${present.join(", ")})`,
    ).toBeLessThanOrEqual(1);
  }
  if (options.axe !== false) await axeSerious(page, label);
  return present;
}
