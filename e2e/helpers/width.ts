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
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.position === "fixed" && style.visibility === "hidden") continue;
      if ((r.right > w + 1 || r.left < -1) && !contained(el))
        offenders.push(describe(el, r));
    }
    return {
      innerWidth: w,
      scrollWidth: document.documentElement.scrollWidth,
      offenders: offenders.slice(0, 15),
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
    `${label}: page scrollWidth ${r.scrollWidth} exceeds viewport ${r.innerWidth}; offenders: ${r.offenders.join(" | ") || "none found"}`,
  ).toBeLessThanOrEqual(r.innerWidth);
  expect(r.offenders, `${label}: elements outside the viewport`).toEqual([]);
}

/**
 * The full FR-16a check for one page on the current project: the project's
 * own width, then 375 px, then 360 px with larger text. Desktop projects
 * check their own width only. The viewport is restored afterwards.
 */
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
