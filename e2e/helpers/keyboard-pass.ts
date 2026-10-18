import { expect, type Page } from "@playwright/test";
import { focusInfo, resetFocusTrail } from "./a11y";

/**
 * REQ-012 FR-3b (AC-8): the scripted keyboard pass over one page. Every
 * focusable element in document order is numbered in the page, then Tab is
 * pressed until focus wraps from the body back to the skip link; every stop
 * must show a visible focus ring (REQ-015's `focusInfo`, computed style) and
 * follow the previous stop in document order (no trap, no backwards jump),
 * and at the end every numbered element must have been reached. Each
 * disclosure met on the way (a `summary` or an `aria-expanded` control) is
 * opened with Enter and closed again; an overlay it opens (a dialog or a
 * menu) must close on Escape with focus back on its trigger.
 */

export type KeyboardPass = {
  /** The stops in order, as `focusInfo` describes them. */
  trail: string[];
  /** Numbered focusable elements the walk never reached. */
  missed: string[];
  /** Disclosures opened and closed on the way. */
  toggled: string[];
};

const FOCUSABLE =
  'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';

/** Numbers every visible, enabled focusable element in document order; returns their descriptions. */
async function numberFocusables(page: Page): Promise<string[]> {
  return page.evaluate((selector) => {
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return (
        (r.width > 0 || r.height > 0) &&
        s.visibility !== "hidden" &&
        s.display !== "none"
      );
    };
    // Content inside a closed <details> is not reachable; the summary is.
    const hidden = (el: Element) => {
      if (el.tagName === "SUMMARY") return false;
      let p = el.parentElement;
      while (p) {
        if (p.tagName === "DETAILS" && !(p as HTMLDetailsElement).open)
          return true;
        p = p.parentElement;
      }
      return false;
    };
    const out: string[] = [];
    let n = 0;
    for (const el of Array.from(document.querySelectorAll(selector))) {
      if (!visible(el) || hidden(el)) continue;
      if ((el as HTMLButtonElement).disabled) continue;
      if (el.closest("fieldset:disabled")) continue;
      // A radio group is one stop: only the checked radio, or the first, is tabbable.
      if (el instanceof HTMLInputElement && el.type === "radio") {
        const group = Array.from(
          document.querySelectorAll<HTMLInputElement>(
            `input[type=radio][name="${CSS.escape(el.name)}"]`,
          ),
        );
        const tabbable = group.find((r) => r.checked) ?? group[0];
        if (tabbable !== el) continue;
      }
      el.setAttribute("data-kb", String(n));
      const label =
        el.getAttribute("aria-label") ||
        (el.id &&
          document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
            ?.textContent) ||
        el.textContent ||
        el.getAttribute("name") ||
        "";
      out.push(
        `${n} ${el.tagName.toLowerCase()} ${label.trim().replace(/\s+/g, " ").slice(0, 40)}`,
      );
      n += 1;
    }
    return out;
  }, FOCUSABLE);
}

async function activeIndex(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const el = document.activeElement;
    const v = el?.getAttribute("data-kb");
    return v === null || v === undefined ? null : Number(v);
  });
}

async function activeDisclosure(
  page: Page,
): Promise<"summary" | "expanded" | null> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return null;
    if (el.tagName === "SUMMARY") return "summary";
    if (el.getAttribute("aria-expanded") === "false") return "expanded";
    return null;
  });
}

async function disclosureOpen(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return false;
    if (el.tagName === "SUMMARY")
      return Boolean((el.parentElement as HTMLDetailsElement)?.open);
    return el.getAttribute("aria-expanded") === "true";
  });
}

async function overlayCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      document.querySelectorAll('[role="dialog"], dialog[open], [role="menu"]')
        .length,
  );
}

export async function keyboardPass(
  page: Page,
  label: string,
): Promise<KeyboardPass> {
  await resetFocusTrail(page);
  // A page may focus its heading on arrival (the questionnaire steps do, REQ-003
  // AC-11); the walk starts from the top of the document so the header's links
  // are counted too.
  await page.evaluate(() => {
    // Blurring alone leaves the sequential-focus starting point on the heading;
    // focusing the body moves it to the top, so the first Tab lands on the first
    // focusable element.
    document.body.tabIndex = -1;
    document.body.focus();
    document.body.removeAttribute("tabindex");
  });
  const numbered = await numberFocusables(page);
  const reached = new Set<number>();
  const trail: string[] = [];
  const toggled: string[] = [];
  const max = numbered.length * 3 + 20;
  let sawElement = false;
  for (let i = 0; i < max; i += 1) {
    await page.keyboard.press("Tab");
    const info = await focusInfo(page);
    if (info.tag === "nextjs-portal") continue;
    trail.push(info.description);
    const previous = trail[trail.length - 2];
    // The end of the page: focus wrapped from the body to the skip link.
    if (
      sawElement &&
      previous === "body" &&
      /Skip to main content/.test(info.description)
    )
      break;
    if (info.tag !== "body") sawElement = true;
    expect(
      info.tag === "body" || info.visibleRing,
      `${label}: no visible focus ring on ${info.description} (${info.evidence})`,
    ).toBe(true);
    if (info.forward === false)
      expect(
        info.forward,
        `${label}: focus moved backwards to ${info.description} (trail: ${trail.slice(-6).join(" > ")})`,
      ).toBe(true);
    const idx = await activeIndex(page);
    if (idx !== null) reached.add(idx);

    const disclosure = await activeDisclosure(page);
    if (disclosure) {
      const before = await overlayCount(page);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(60);
      expect(
        await disclosureOpen(page),
        `${label}: Enter did not open ${info.description}`,
      ).toBe(true);
      const after = await overlayCount(page);
      if (after > before) {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(60);
        expect(
          await overlayCount(page),
          `${label}: Escape did not close what Enter opened on ${info.description}`,
        ).toBe(before);
        expect(
          await activeIndex(page),
          `${label}: focus did not return to ${info.description} after Escape`,
        ).toBe(idx);
      } else {
        // A disclosure with no overlay (a details element, an expanding panel) closes with Enter again.
        await page.keyboard.press("Enter");
        await page.waitForTimeout(60);
        expect(
          await disclosureOpen(page),
          `${label}: Enter did not close ${info.description} again`,
        ).toBe(false);
      }
      toggled.push(info.description);
    }
  }
  const missed = numbered.filter((_, n) => !reached.has(n));
  return { trail, missed, toggled };
}
