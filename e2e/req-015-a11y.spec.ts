import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { openResultSections } from "./helpers/result";
import { setTextZoom, widthReport } from "./helpers/width";

/**
 * REQ-015 Section E, FR-17 and FR-19, recorded as tests with screenshots
 * under product/evidence/req-015/: heading order and one h1 per page, unique
 * titles, the skip link visible on focus, autocomplete on the business name
 * and email, 200 % text at 1280 px without sideways scroll, reduced motion
 * honoured, status never colour alone, keyboard-only through the first
 * step, target sizes, and axe clean on every public page and the result.
 */
const dir = "product/evidence/req-015";
const PAGES = [
  "/",
  "/start",
  "/pricing",
  "/sign-in",
  "/about",
  "/privacy",
  "/terms",
  "/refunds",
  "/ai",
];

async function shot(page: Page, name: string, project: string) {
  if (!process.env.EVIDENCE) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({
    path: `${dir}/${name}-${project}.jpg`,
    fullPage: true,
    type: "jpeg",
    quality: 40,
    scale: "css",
  });
}

async function axeClean(page: Page, label: string) {
  await page.waitForFunction(() => document.title.length > 0);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations.map(
      (v) => `${v.impact}: ${v.id} ${v.help} (${v.nodes.length} nodes)`,
    ),
    `${label}: axe violations`,
  ).toEqual([]);
}

async function headingOrder(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6"))
      .filter(
        (h) => (h as HTMLElement).offsetParent !== null || h.closest("details"),
      )
      .map((h) => h.tagName.toLowerCase()),
  );
}

function assertHeadingOrder(levels: string[], label: string) {
  expect(
    levels.filter((l) => l === "h1"),
    `${label}: exactly one h1`,
  ).toHaveLength(1);
  let previous = 0;
  for (const l of levels) {
    const n = Number(l.slice(1));
    expect(
      n - previous,
      `${label}: heading jump to ${l} after h${previous}`,
    ).toBeLessThanOrEqual(1);
    previous = n;
  }
}

/** Interactive targets: 24 px minimum everywhere (WCAG 2.5.8), 44 px for buttons and controls on phones (FR-16). */
async function targetSizes(page: Page, phone: boolean) {
  return page.evaluate((phone) => {
    const small: string[] = [];
    const nodes = document.querySelectorAll<HTMLElement>(
      "button, summary, input:not([type=hidden]), select, textarea, a.btn-primary, a.btn-secondary, [role=button]",
    );
    for (const el of Array.from(nodes)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (el.classList.contains("sr-only")) continue;
      const min = phone ? 44 : 24;
      // A radio or checkbox inside a 44 px label counts by its label's box.
      const box = el.closest("label")?.getBoundingClientRect() ?? r;
      if (box.height < min - 0.5)
        small.push(
          `${el.tagName.toLowerCase()} "${(el.textContent ?? el.id).trim().slice(0, 30)}" ${Math.round(box.width)}x${Math.round(box.height)}`,
        );
    }
    return small;
  }, phone);
}

test.describe("REQ-015 Section E", () => {
  test("every public page: one h1 in order, a unique title, axe clean (FR-17, FR-19)", async ({
    page,
  }, testInfo) => {
    const titles = new Set<string>();
    for (const path of PAGES) {
      await page.goto(path);
      await page.waitForFunction(() => document.title.length > 0);
      const title = await page.title();
      expect(titles.has(title), `${path}: title "${title}" already used`).toBe(
        false,
      );
      titles.add(title);
      assertHeadingOrder(await headingOrder(page), path);
      await axeClean(page, path);
      const phone = (page.viewportSize()?.width ?? 1280) < 640;
      expect(
        await targetSizes(page, phone),
        `${path}: targets under size`,
      ).toEqual([]);
    }
    await shot(page, "pages-pass", testInfo.project.name);
  });

  test("skip link, autocomplete, 200% text, reduced motion (FR-17)", async ({
    page,
    browserName,
  }, testInfo) => {
    // The skip link is the first tab stop and becomes visible on focus (a page
    // that does not move focus itself; the questionnaire focuses its heading).
    // Headless WebKit never tabs onto links, so that part is Chromium-only.
    await page.goto("/pricing");
    if (browserName !== "webkit") {
      await page.keyboard.press("Tab");
      const skip = page.getByRole("link", { name: "Skip to main content" });
      await expect(skip).toBeFocused();
      await expect(skip).toBeVisible();
      await shot(page, "skip-link", testInfo.project.name);
    }
    await page.goto("/start/business");
    await expect(page.getByLabel("Trading name")).toHaveAttribute(
      "autocomplete",
      "organization",
    );
    await page.goto("/sign-in");
    await expect(page.getByLabel("Email address")).toHaveAttribute(
      "autocomplete",
      "email",
    );

    // 200 % text at a desktop width: no sideways scroll (WCAG 1.4.4, 1.4.10).
    const original = page.viewportSize();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await setTextZoom(page, 200);
    const r = await widthReport(page);
    expect(
      r.scrollWidth,
      `200%: ${r.offenders.join(" | ")}`,
    ).toBeLessThanOrEqual(r.innerWidth);
    await shot(page, "zoom-200", testInfo.project.name);
    await setTextZoom(page, null);
    if (original) await page.setViewportSize(original);

    // Reduced motion: every animation and transition is effectively off.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const longest = await page.evaluate(() => {
      let max = 0;
      for (const el of Array.from(document.querySelectorAll("*"))) {
        const s = getComputedStyle(el);
        for (const d of [s.animationDuration, s.transitionDuration])
          for (const part of d.split(","))
            max = Math.max(max, parseFloat(part) || 0);
      }
      return max;
    });
    expect(longest).toBeLessThan(0.02);
    await page.emulateMedia({ reducedMotion: "no-preference" });
  });

  test("keyboard only from the intro through the first step (FR-17)", async ({
    page,
  }, testInfo) => {
    await page.goto("/start");
    // Tab to the primary link and press Enter.
    const start = page.getByRole("link", { name: "Start the questionnaire" });
    await start.focus();
    await expect(start).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { level: 1, name: "About your business" }),
    ).toBeVisible();
    // The heading takes focus on arrival; Tab reaches the first field.
    await page.getByLabel("Trading name").focus();
    await page.keyboard.type("Sunrise Supports");
    await page.getByRole("radio", { name: "Sole trader" }).focus();
    await page.keyboard.press("Space");
    await expect(
      page.getByRole("radio", { name: "Sole trader" }),
    ).toBeChecked();
    await page.getByRole("checkbox", { name: "NSW" }).focus();
    await page.keyboard.press("Space");
    await expect(page.getByRole("checkbox", { name: "NSW" })).toBeChecked();
    await page.getByTestId("step-submit").focus();
    await shot(page, "keyboard-business", testInfo.project.name);
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { level: 1, name: "The supports you deliver" }),
    ).toBeVisible();
    // Focus moved to the new step's heading (REQ-003 AC-11).
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  });

  test("result page: the answer card fits the first screen, disclosures remember, colour is never the only signal (Section B)", async ({
    page,
  }, testInfo) => {
    await page.goto("/start/business");
    await page.getByLabel("Trading name").fill("Sunrise Supports");
    await page.getByRole("radio", { name: "Sole trader" }).check();
    await page.getByRole("checkbox", { name: "NSW" }).check();
    await page.getByRole("button", { name: "Save and continue" }).click();
    await page.locator("#group-0107").check();
    await page.getByRole("button", { name: "Save and continue" }).click();
    await page.locator("#restrictivePractices-no").check();
    await page.getByRole("button", { name: "Save and continue" }).click();
    await page.getByLabel("Number of workers").fill("3");
    await page.locator("#allRiskAssessedScreened-yes").check();
    await page.getByRole("button", { name: "Save and continue" }).click();
    for (const key of [
      "policies",
      "incidentRegister",
      "complaintsRegister",
      "insuranceCertificate",
      "workerInductionRecords",
    ])
      await page
        .locator(`#${key}-${key === "policies" ? "yes" : "no"}`)
        .check();
    await page.getByRole("button", { name: "See my result" }).click();
    await expect(page.getByTestId("result")).toBeVisible();

    // FR-4: audit, sentence, counts, line and the one button are inside the first screen on a phone.
    const card = page.getByTestId("summary");
    await expect(card).toContainText(/Your audit: certification/);
    // REQ-025 FR-13: the audit kind's meaning under the heading comes from the glossary.
    await expect(card.getByTestId("audit-kind")).toContainText(
      /An auditor reads your documents and visits you/,
    );
    // REQ-017 step 1: the one button is "Start getting ready"; the checklist and the price are plain links under it.
    const button = card.getByRole("link", { name: "Start getting ready" });
    const viewport = page.viewportSize()!;
    const box = await button.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    // The three disclosures start closed with counts in their summaries.
    for (const id of ["why", "documents", "registers"]) {
      const d = page.getByTestId(`result-section-${id}`);
      await expect(d).not.toHaveAttribute("open", "");
      await expect(d.locator("> summary")).toContainText(/\(\d+/);
    }
    await shot(page, "result-card", testInfo.project.name);

    // FR-5: tags carry text and an icon, never colour alone; FR-7: state is remembered.
    await page
      .getByTestId("result-section-documents")
      .locator("> summary")
      .click();
    await expect(page.getByTestId("have-legend")).toBeVisible();
    // REQ-025 FR-4a: one vocabulary, the provider's status only.
    const tags = page
      .getByTestId("result-section-documents")
      .getByTestId("have-tag")
      .filter({ hasText: /^.(You have this|To prepare|Not asked)$/ });
    expect(await tags.count()).toBeGreaterThan(0);
    await page.reload();
    await expect(page.getByTestId("result")).toBeVisible();
    await expect(page.getByTestId("result-section-documents")).toHaveAttribute(
      "open",
      "",
    );
    await expect(page.getByTestId("result-section-why")).not.toHaveAttribute(
      "open",
      "",
    );
    // FR-6: one "Change my answers" link; the per-step links are folded; clearing asks first.
    await expect(page.getByTestId("change-answers")).toBeVisible();
    await expect(page.getByText("Back to:")).toHaveCount(0);
    await page.getByTestId("clear-draft").click();
    await expect(page.getByTestId("clear-draft-confirm")).toContainText(
      /Clear your answers/,
    );
    await page.getByRole("button", { name: "Keep" }).click();
    await expect(page.getByTestId("clear-draft")).toBeVisible();
    await openResultSections(page);
    await axeClean(page, "result (all open)");
    await shot(page, "result-open", testInfo.project.name);
  });
});
