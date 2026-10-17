import { expect, type Page } from "@playwright/test";

/**
 * REQ-015 FR-16a: no sideways movement on any page. The page must not be
 * wider than the viewport, and no element's box may sit outside it unless an
 * ancestor scrolls or clips sideways on its own (a table in an
 * `overflow-x-auto` wrapper). Run at the project's width, at 375 px, and at
 * 360 px with the root font size at 130 % (the phone's larger-text setting),
 * because `white-space: nowrap` and fixed widths overflow only then.
 */
export type WidthReport = {
  innerWidth: number;
  scrollWidth: number;
  offenders: string[];
  /** Elements whose own content runs past their box sideways without a scrolling ancestor: the 2 px case the edge check cannot name (REQ-028, #87 run 1). */
  overflowing: string[];
};

export async function widthReport(page: Page): Promise<WidthReport> {
  // A redirecting page can be between documents for a moment; wait for a body.
  await page.waitForFunction(() => Boolean(document.body));
  await page.waitForLoadState("domcontentloaded");
  return page.evaluate(() => {
    const w = window.innerWidth;
    const contained = (el: Element): boolean => {
      let p = el.parentElement;
      while (p) {
        const o = getComputedStyle(p).overflowX;
        if (o === "auto" || o === "scroll" || o === "hidden" || o === "clip")
          return true;
        p = p.parentElement;
      }
      return false;
    };
    const describe = (el: Element, r: DOMRect) => {
      const cls =
        typeof el.className === "string"
          ? el.className.split(/\s+/).filter(Boolean).slice(0, 4).join(".")
          : "";
      const text = (el.textContent ?? "").trim().replace(/\s+/g, " ");
      return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${cls ? `.${cls}` : ""} left=${Math.round(r.left)} right=${Math.round(r.right)} "${text.slice(0, 50)}"`;
    };
    const offenders: string[] = [];
    const overflowing: string[] = [];
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.position === "fixed" && style.visibility === "hidden") continue;
      if ((r.right > w + 1 || r.left < -1) && !contained(el))
        offenders.push(describe(el, r));
      // A box inside the viewport whose text or children run past its right
      // edge (a long word in a heading at 200 % text) widens the page by the
      // overhang alone; the edge check above never names it.
      if (
        el.clientWidth > 0 &&
        el.scrollWidth > el.clientWidth + 1 &&
        style.overflowX === "visible" &&
        !contained(el)
      )
        overflowing.push(
          `${describe(el, r)} content ${el.scrollWidth} in a box of ${el.clientWidth}`,
        );
    }
    return {
      innerWidth: w,
      scrollWidth: document.documentElement.scrollWidth,
      offenders: offenders.slice(0, 15),
      overflowing: overflowing.slice(0, 8),
    };
  });
}

/** Sets or clears the root font size through the CSSOM (allowed by the nonce CSP, unlike a style attribute). */
export async function setTextZoom(page: Page, percent: number | null) {
  // A late redirect (WebKit resolves goto before the final document) destroys
  // the context once; wait for the page to settle and try again.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.evaluate((p) => {
        document.documentElement.style.fontSize = p === null ? "" : `${p}%`;
      }, percent);
      // Let the layout settle.
      await page.evaluate(
        () =>
          new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50))),
      );
      return;
    } catch (e) {
      if (attempt === 1) throw e;
      await page.waitForLoadState("networkidle");
    }
  }
}

export async function expectNoSidewaysScroll(page: Page, label: string) {
  const r = await widthReport(page);
  expect(
    r.scrollWidth,
    `${label}: page scrollWidth ${r.scrollWidth} exceeds viewport ${r.innerWidth}; offenders: ${r.offenders.join(" | ") || "none found"}; overflowing content: ${r.overflowing.join(" | ") || "none found"}`,
  ).toBeLessThanOrEqual(r.innerWidth);
  expect(r.offenders, `${label}: elements outside the viewport`).toEqual([]);
}

/**
 * The full FR-16a check for one page on the current project: the project's
 * own width, then 375 px, then 360 px with larger text. Desktop projects
 * check their own width only. The viewport is restored afterwards.
 */
/**
 * REQ-013 batch 36 item 1: no word in a table, a stacked table or a
 * definition list may be broken across lines. A word broken by the layout
 * paints as more than one client rectangle, so each word is wrapped in a
 * Range and its rectangles counted. `roots` widens the check to another
 * container (a register list, REQ-018 AC-1); the default is the tables.
 */
export const BROKEN_WORD_ROOTS = 'table, dl, [data-testid="data-table"]';

export async function expectNoBrokenWords(
  page: Page,
  label: string,
  roots: string = BROKEN_WORD_ROOTS,
) {
  const broken = await page.evaluate((selector) => {
    const out: string[] = [];
    const roots = document.querySelectorAll(selector);
    const walkerFor = (root: Element) =>
      document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (const root of roots) {
      const walker = walkerFor(root);
      let node: Node | null = walker.nextNode();
      while (node) {
        const text = node.textContent ?? "";
        const re = /\S{3,}/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text))) {
          const range = document.createRange();
          range.setStart(node, m.index);
          range.setEnd(node, m.index + m[0].length);
          const rects = Array.from(range.getClientRects()).filter(
            (r) => r.width > 0 && r.height > 0,
          );
          const tops = new Set(rects.map((r) => Math.round(r.top)));
          if (tops.size > 1) out.push(m[0]);
        }
        node = walker.nextNode();
      }
    }
    return [...new Set(out)].slice(0, 10);
  }, roots);
  expect(broken, `${label}: words broken across lines`).toEqual([]);
}

/** Tables at the project's width, then 360 and 390 px on phones: no sideways scroll and no broken word (batch 36). */
export async function checkTables(page: Page, label: string) {
  const original = page.viewportSize();
  const phone = (original?.width ?? 1280) < 640;
  await expectNoBrokenWords(page, `${label} @${original?.width}`);
  if (!phone) return;
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: original?.height ?? 740 });
    await expectNoSidewaysScroll(page, `${label} tables @${width}`);
    await expectNoBrokenWords(page, `${label} @${width}`);
  }
  if (original) await page.setViewportSize(original);
}

export async function checkWidths(page: Page, label: string) {
  const original = page.viewportSize();
  const phone = (original?.width ?? 1280) < 640;
  await expectNoSidewaysScroll(page, `${label} @${original?.width}`);
  if (!phone) return;
  for (const width of [375, 360]) {
    await page.setViewportSize({ width, height: original?.height ?? 740 });
    await expectNoSidewaysScroll(page, `${label} @${width}`);
  }
  await setTextZoom(page, 130);
  await expectNoSidewaysScroll(page, `${label} @360 text 130%`);
  await setTextZoom(page, null);
  if (original) await page.setViewportSize(original);
}
