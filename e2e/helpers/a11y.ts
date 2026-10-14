import { expect, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { setTextZoom, widthReport } from "./width";

/**
 * The accessibility pass (REQ-015 Section E, standing backlog 1): the checks
 * every page gets on all three projects, and the keyboard walk that the
 * questionnaire, the finish form, the adopt screen and a register form go
 * through with no pointer. Each helper fails with the offending element in
 * the message so a failure reads as a fix.
 */

/** axe over the WCAG 2.0, 2.1 and 2.2 A and AA rules; serious and critical fail, the rest are returned for the annotation. */
export async function axeSerious(page: Page, label: string): Promise<string[]> {
  // A page without a title within 20 s is an error page or a stalled load; say which page.
  await page
    .waitForFunction(() => document.title.length > 0, undefined, {
      timeout: 20_000,
    })
    .catch(() => {
      throw new Error(
        `${label}: the page never got a title (url ${page.url()})`,
      );
    });
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(
    serious.map(
      (v) =>
        `${v.impact}: ${v.id} ${v.help} (${v.nodes
          .slice(0, 3)
          .map((n) => n.target.join(" "))
          .join("; ")})`,
    ),
    `${label}: serious or critical axe violations`,
  ).toEqual([]);
  return results.violations.map((v) => `${v.impact}:${v.id}`);
}

/**
 * Every visible control has an accessible name, every table has a caption
 * or a label, and every register list is labelled by its heading (WCAG
 * 4.1.2, 1.3.1). Computed in the page the way a screen reader would hear
 * it: aria-label, aria-labelledby, an associated label, the text inside
 * (an image's alt, an SVG's title), a title, or a submit's value.
 */
export async function accessibleNames(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return (
        (r.width > 0 || r.height > 0) &&
        s.visibility !== "hidden" &&
        s.display !== "none"
      );
    };
    const textOf = (el: Element): string => {
      let out = "";
      for (const n of Array.from(el.childNodes)) {
        if (n.nodeType === Node.TEXT_NODE) out += n.textContent ?? "";
        else if (n instanceof Element) {
          if (n.getAttribute("aria-hidden") === "true") continue;
          const label = n.getAttribute("aria-label");
          if (label) {
            out += ` ${label} `;
            continue;
          }
          if (n.tagName === "IMG") out += ` ${n.getAttribute("alt") ?? ""} `;
          else if (n.tagName === "svg")
            out += ` ${n.querySelector("title")?.textContent ?? ""} `;
          else out += textOf(n);
        }
      }
      return out;
    };
    const byIds = (ids: string | null) =>
      (ids ?? "")
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent ?? "")
        .join(" ");
    const nameOf = (el: Element): string => {
      const aria = el.getAttribute("aria-label");
      if (aria?.trim()) return aria;
      const labelled = byIds(el.getAttribute("aria-labelledby"));
      if (labelled.trim()) return labelled;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLTextAreaElement
      ) {
        const labels = Array.from(el.labels ?? [])
          .map((l) => textOf(l))
          .join(" ");
        if (labels.trim()) return labels;
        if (
          el instanceof HTMLInputElement &&
          /^(submit|button|reset)$/.test(el.type) &&
          el.value.trim()
        )
          return el.value;
      }
      const inner = textOf(el);
      if (inner.trim()) return inner;
      const title = el.getAttribute("title");
      if (title?.trim()) return title;
      return "";
    };
    const describe = (el: Element) =>
      `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${
        el.getAttribute("data-testid")
          ? `[data-testid=${el.getAttribute("data-testid")}]`
          : ""
      }`;
    const offenders: string[] = [];
    const controls = document.querySelectorAll(
      'a[href], button, [role="button"], input:not([type="hidden"]), select, textarea, summary, [tabindex="0"]',
    );
    for (const el of Array.from(controls)) {
      if (!visible(el)) continue;
      if (!nameOf(el).trim())
        offenders.push(`no accessible name: ${describe(el)}`);
    }
    for (const t of Array.from(document.querySelectorAll("table"))) {
      if (!visible(t)) continue;
      const named =
        t.querySelector("caption")?.textContent?.trim() ||
        t.getAttribute("aria-label")?.trim() ||
        byIds(t.getAttribute("aria-labelledby")).trim();
      if (!named)
        offenders.push(`table without a caption or label: ${describe(t)}`);
      for (const th of Array.from(t.querySelectorAll("th")))
        if (!th.textContent?.trim() && !th.getAttribute("aria-label"))
          offenders.push(`empty header cell in ${describe(t)}`);
    }
    // A register list (an index of records) reads as "list, <heading>" rather than "list".
    const lists = document.querySelectorAll(
      '[data-testid$="-list"] ul, [data-testid$="-list"] ol, [data-testid="registers-index"] ul, [data-testid="events-trail"] ol',
    );
    for (const l of Array.from(lists)) {
      if (!visible(l)) continue;
      const named =
        l.getAttribute("aria-label")?.trim() ||
        byIds(l.getAttribute("aria-labelledby")).trim();
      if (!named)
        offenders.push(`register list without a label: ${describe(l)}`);
    }
    return offenders;
  });
}

/** The longest animation or transition on the page with reduced motion requested; must be effectively zero. */
export async function reducedMotionMax(page: Page): Promise<number> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const max = await page.evaluate(() => {
    let longest = 0;
    for (const el of Array.from(document.querySelectorAll("*"))) {
      const s = getComputedStyle(el);
      for (const d of [s.animationDuration, s.transitionDuration])
        for (const part of d.split(","))
          longest = Math.max(longest, parseFloat(part) || 0);
      if (s.scrollBehavior === "smooth") longest = Math.max(longest, 1);
    }
    return longest;
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  return max;
}

/** 200 % text on the current viewport: the page must not scroll sideways and nothing may sit outside it (WCAG 1.4.4, 1.4.10). */
export async function zoom200NoSidewaysScroll(page: Page, label: string) {
  await setTextZoom(page, 200);
  const r = await widthReport(page);
  await setTextZoom(page, null);
  expect(
    r.scrollWidth,
    `${label} at 200% text: page scrollWidth ${r.scrollWidth} exceeds viewport ${r.innerWidth}; offenders: ${r.offenders.join(" | ") || "none found"}`,
  ).toBeLessThanOrEqual(r.innerWidth);
  expect(
    r.offenders,
    `${label} at 200% text: elements outside the viewport`,
  ).toEqual([]);
}

/**
 * Opens a page and lets it settle. WebKit resolves a navigation before a
 * client-side redirect has finished, so a goto that is "interrupted by
 * another navigation" is retried once after the page goes quiet.
 */
export async function gotoSettled(page: Page, path: string) {
  let status = 0;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await page.goto(path);
      status = response?.status() ?? 0;
      if (status < 400 && status !== 0) break;
    } catch (e) {
      if (!/interrupted by another navigation/.test(String(e))) throw e;
    }
    // WebKit resolves a navigation before a client-side redirect has finished, and a dev server can drop one response; settle and try again.
    await page.waitForLoadState("networkidle").catch(() => undefined);
  }
  expect(status, `${path}: the page answered ${status}`).toBeLessThan(400);
  await page.waitForLoadState("domcontentloaded");
}

/** The whole page pass: axe, names, motion, zoom. Returns axe's full list for the annotation. */
export async function pagePass(page: Page, label: string): Promise<string[]> {
  const axe = await axeSerious(page, label);
  expect(await accessibleNames(page), `${label}: accessible names`).toEqual([]);
  expect(
    await reducedMotionMax(page),
    `${label}: motion with reduced motion requested`,
  ).toBeLessThan(0.02);
  await zoom200NoSidewaysScroll(page, label);
  return axe;
}

type FocusInfo = {
  description: string;
  /** The focus ring is on the element itself or, for a visually hidden input, on its label (WCAG 2.4.7). */
  visibleRing: boolean;
  /** True when this element follows the previous one in document order. */
  forward: boolean | null;
  tag: string;
  type: string;
};

/** Describes the active element, whether its focus is visible, and whether it follows the element focused before. */
export async function focusInfo(page: Page): Promise<FocusInfo> {
  return page.evaluate(() => {
    const w = window as unknown as { __lastFocused?: Element | null };
    const el = document.activeElement;
    if (!el || el === document.body)
      return {
        description: "body",
        visibleRing: false,
        forward: null,
        tag: "body",
        type: "",
      };
    // The Next.js development overlay is not part of the product; a production build has no such element.
    if (el.tagName.toLowerCase() === "nextjs-portal")
      return {
        description: "nextjs-portal (development overlay, skipped)",
        visibleRing: true,
        forward: null,
        tag: "nextjs-portal",
        type: "",
      };
    const ring = (target: Element) => {
      const s = getComputedStyle(target);
      const outline =
        s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0;
      const shadow = s.boxShadow !== "none";
      return outline || shadow;
    };
    const s = getComputedStyle(el);
    const hidden =
      parseFloat(s.opacity) === 0 || el.classList.contains("sr-only");
    const host = hidden ? (el.closest("label") ?? el) : el;
    const visibleRing =
      ring(host) && getComputedStyle(host).visibility !== "hidden";
    const prev = w.__lastFocused ?? null;
    const forward =
      prev && prev !== el
        ? Boolean(
            prev.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING,
          )
        : null;
    w.__lastFocused = el;
    const text = (el.textContent ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 40);
    return {
      description: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${
        el.getAttribute("data-testid")
          ? `[${el.getAttribute("data-testid")}]`
          : ""
      }${text ? ` "${text}"` : ""}`,
      visibleRing,
      forward,
      tag: el.tagName.toLowerCase(),
      type: (el as HTMLInputElement).type ?? "",
    };
  });
}

/** Forgets the last focused element, so the first Tab on a new page is not compared with the old one. */
export async function resetFocusTrail(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { __lastFocused?: Element | null }).__lastFocused =
      null;
  });
}

export type KeyboardWalk = { steps: string[] };

/**
 * Presses Tab until the locator is focused. Every stop on the way must show
 * a visible focus ring and lie after the previous stop in document order
 * (a logical order, no trap); a date input may keep focus for its own
 * segments. Fails with the trail when the target is not reached in `max`
 * presses.
 */
export async function tabUntil(
  page: Page,
  target: Locator,
  walk: KeyboardWalk,
  options: { max?: number; label?: string } = {},
): Promise<number> {
  const max = options.max ?? 60;
  let same = 0;
  for (let i = 1; i <= max; i += 1) {
    await page.keyboard.press("Tab");
    const info = await focusInfo(page);
    if (info.tag === "nextjs-portal") continue;
    walk.steps.push(info.description);
    const isTarget = await target.evaluate(
      (el) => el === document.activeElement,
    );
    if (info.forward === null && info.tag !== "body") {
      // The same element again: only a date input moving through its own segments may do that.
      const previous = walk.steps[walk.steps.length - 2];
      if (previous === info.description) {
        same += 1;
        expect(
          info.type === "date" && same <= 3,
          `${options.label ?? "keyboard"}: focus stayed on ${info.description} after Tab (trap?)`,
        ).toBe(true);
      }
    } else same = 0;
    expect(
      info.tag === "body" || info.visibleRing,
      `${options.label ?? "keyboard"}: no visible focus ring on ${info.description}`,
    ).toBe(true);
    if (info.forward === false)
      expect(
        info.forward,
        `${options.label ?? "keyboard"}: focus moved backwards to ${info.description} (trail: ${walk.steps.slice(-6).join(" > ")})`,
      ).toBe(true);
    if (isTarget) return i;
  }
  throw new Error(
    `${options.label ?? "keyboard"}: target not reached in ${max} Tabs; trail: ${walk.steps.slice(-12).join(" > ")}`,
  );
}

/**
 * Chooses a radio by keyboard: Tab to its group (the checked or the first
 * radio), then the arrow keys until the wanted one is checked.
 */
export async function pickRadio(
  page: Page,
  target: Locator,
  walk: KeyboardWalk,
  label: string,
) {
  const id = (await target.getAttribute("id")) ?? "radio";
  const name = await target.getAttribute("name");
  const group = page.locator(`input[type="radio"][name="${name}"]`);
  // Tab until any radio of the group holds focus.
  const max = 60;
  let reached = false;
  for (let i = 0; i < max; i += 1) {
    await page.keyboard.press("Tab");
    const info = await focusInfo(page);
    if (info.tag === "nextjs-portal") continue;
    walk.steps.push(info.description);
    expect(
      info.tag === "body" || info.visibleRing,
      `${label}: no visible focus ring on ${info.description}`,
    ).toBe(true);
    if (
      await group.evaluateAll((els) =>
        els.some((e) => e === document.activeElement),
      )
    ) {
      reached = true;
      break;
    }
  }
  expect(
    reached,
    `${label}: the radio group of ${id} was not reached; trail: ${walk.steps.slice(-8).join(" > ")}`,
  ).toBe(true);
  // Arrow down until the wanted radio holds focus; Chromium checks it on
  // the way, WebKit only moves focus and checks on Space.
  const count = await group.count();
  for (let i = 0; i <= count; i += 1) {
    if (await target.evaluate((el) => el === document.activeElement)) {
      if (!(await target.isChecked())) await page.keyboard.press("Space");
      break;
    }
    await page.keyboard.press("ArrowDown");
  }
  await expect(target, `${label}: ${id} checked by keyboard`).toBeChecked();
}

/** Chooses a select option by keyboard: arrow keys from the focused select until the value matches, then type-ahead as a fallback. */
export async function pickOption(
  page: Page,
  selectId: string,
  value: string,
  label: string,
) {
  const select = page.locator(`[id="${selectId}"]`);
  await expect(select, `${label}: ${selectId} has focus`).toBeFocused();
  const count = await select.locator("option").count();
  for (let i = 0; i <= count; i += 1) {
    if ((await select.inputValue()) === value) return;
    await page.keyboard.press("ArrowDown");
  }
  const text = await select.locator(`option[value="${value}"]`).textContent();
  await page.keyboard.type((text ?? "").trim().slice(0, 4));
  await expect(select, `${label}: ${selectId} set by keyboard`).toHaveValue(
    value,
  );
}
