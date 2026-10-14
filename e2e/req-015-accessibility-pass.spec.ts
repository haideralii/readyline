import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import {
  axeSerious,
  gotoSettled,
  pagePass,
  pickRadio,
  resetFocusTrail,
  tabUntil,
  type KeyboardWalk,
} from "./helpers/a11y";

/**
 * REQ-015 Section E, the accessibility pass (standing backlog 1, D-1508), on
 * all three projects: axe (serious and critical) on every public page, every
 * control named and every table or register list labelled, reduced motion
 * honoured, 200 % text without sideways scroll at the project's own width,
 * and the questionnaire from the intro to the result with the keyboard only
 * (a visible focus ring on every stop, a forward order, no trap). The
 * signed-in pages are in e2e/signed-in/accessibility-pass.spec.ts; Finish
 * your pack and Adopt are in the guided-path spec. Screenshots under
 * product/evidence/req-015/ with EVIDENCE=1.
 */
const dir = "product/evidence/req-015";
const PUBLIC_PAGES = [
  "/",
  "/start",
  "/pricing",
  "/sign-in",
  "/about",
  "/privacy",
  "/terms",
  "/refunds",
  "/ai",
  "/guides",
  "/guides/registration-groups",
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

/** Waits for the step's heading, which takes focus on arrival once the step has hydrated (REQ-003 AC-11). */
async function stepReady(page: Page, heading: string) {
  const h1 = page.getByRole("heading", { level: 1, name: heading });
  await expect(h1).toBeVisible();
  await expect(h1)
    .toBeFocused({ timeout: 5000 })
    .catch(() => undefined);
  // The form is in the server HTML as a disabled fieldset until the draft
  // has loaded, and on a client-side move between steps it is its own chunk
  // (D-1012); a Tab before either skips its fields.
  await expect(page.locator("main form").first()).toBeVisible();
  await expect(page.locator('fieldset[aria-busy="true"]')).toHaveCount(0);
  await resetFocusTrail(page);
}

async function submitStep(page: Page, walk: KeyboardWalk, label: string) {
  await tabUntil(page, page.getByTestId("step-submit"), walk, { label });
  await page.keyboard.press("Enter");
}

test.describe("accessibility pass (REQ-015 Section E, backlog 1)", () => {
  // Thirteen pages, each with axe, a zoom pass and a motion pass, on a dev server that compiles on first hit.
  test.describe.configure({ timeout: 240_000 });

  test("every public page: axe clean, every control named, reduced motion honoured, 200% text without sideways scroll", async ({
    page,
  }, testInfo) => {
    const pages = [...PUBLIC_PAGES];
    // One guide and one registration group, whichever the index pages list first.
    await page.goto("/guides");
    const guide = await page
      .locator(
        'main a[href^="/guides/"]:not([href="/guides/registration-groups"])',
      )
      .first()
      .getAttribute("href");
    if (guide) pages.push(guide);
    await page.goto("/guides/registration-groups");
    const group = await page
      .locator('main a[href^="/guides/registration-groups/"]')
      .first()
      .getAttribute("href");
    if (group) pages.push(group);

    const summary: Record<string, string[]> = {};
    for (const path of pages) {
      await gotoSettled(page, path);
      summary[path] = await pagePass(page, path);
    }
    testInfo.annotations.push({
      type: "axe-summary",
      description: JSON.stringify(summary),
    });
    await shot(page, "a11y-pages", testInfo.project.name);
  });

  test("keyboard only from the intro to the result: visible focus, forward order, no trap", async ({
    page,
    browserName,
  }, testInfo) => {
    const walk: KeyboardWalk = { steps: [] };
    await page.goto("/start");
    // Headless WebKit neither tabs onto links nor follows one on Enter, so on
    // WebKit the first step is opened by address; everything after it is Tab
    // and keys. Chromium focuses the one link and presses Enter.
    if (browserName === "webkit") await page.goto("/start/business");
    else {
      const start = page.getByRole("link", { name: "Start the questionnaire" });
      await start.focus();
      await expect(start).toBeFocused();
      await page.keyboard.press("Enter");
    }

    await stepReady(page, "About your business");
    await tabUntil(page, page.getByLabel("Trading name"), walk, {
      label: "business",
    });
    await page.keyboard.type("Sunrise Supports");
    await pickRadio(
      page,
      page.getByRole("radio", { name: "Sole trader" }),
      walk,
      "business",
    );
    const nsw = page.getByRole("checkbox", { name: "NSW" });
    await tabUntil(page, nsw, walk, { label: "business" });
    await page.keyboard.press("Space");
    await expect(nsw).toBeChecked();
    await axeSerious(page, "business (filled by keyboard)");
    await shot(page, "keyboard-business-filled", testInfo.project.name);
    await submitStep(page, walk, "business");

    await stepReady(page, "The supports you deliver");
    // REQ-013 FR-11: the everyday headings start closed on phones; open the one that holds 0107 with Enter.
    const heading = page.locator('[data-open][data-codes~="0107"]');
    if ((await heading.getAttribute("data-open")) === "false") {
      await tabUntil(page, heading.getByRole("button").first(), walk, {
        label: "supports",
      });
      await page.keyboard.press("Enter");
      await expect(heading).toHaveAttribute("data-open", "true");
    }
    const personalCare = page.locator("#group-0107");
    await tabUntil(page, personalCare, walk, { label: "supports" });
    await page.keyboard.press("Space");
    await expect(personalCare).toBeChecked();
    await submitStep(page, walk, "supports");

    await stepReady(page, "Restrictive practices");
    await pickRadio(
      page,
      page.locator("#restrictivePractices-no"),
      walk,
      "practices",
    );
    await submitStep(page, walk, "practices");

    await stepReady(page, "Your workforce");
    await tabUntil(page, page.getByLabel("Number of workers"), walk, {
      label: "workforce",
    });
    await page.keyboard.type("3");
    const keyPersonnel = page.getByLabel("Number of key personnel");
    if (await keyPersonnel.count()) {
      await tabUntil(page, keyPersonnel, walk, { label: "workforce" });
      await page.keyboard.type("1");
    }
    for (const id of [
      "hasRiskAssessedRoles-yes",
      "allRiskAssessedScreened-yes",
    ]) {
      const radio = page.locator(`#${id}`);
      if (await radio.count()) await pickRadio(page, radio, walk, "workforce");
    }
    await submitStep(page, walk, "workforce");

    await stepReady(page, "What you already have");
    for (const key of [
      "policies",
      "incidentRegister",
      "complaintsRegister",
      "insuranceCertificate",
      "workerInductionRecords",
    ])
      await pickRadio(page, page.locator(`#${key}-no`), walk, "existing");
    await shot(page, "keyboard-existing", testInfo.project.name);
    await submitStep(page, walk, "existing");

    await expect(page.getByTestId("result")).toBeVisible();
    await expect(page.getByTestId("summary")).toContainText(
      /Your audit: certification/,
    );
    await axeSerious(page, "result (reached by keyboard)");
    await shot(page, "keyboard-result", testInfo.project.name);
    testInfo.annotations.push({
      type: "keyboard-stops",
      description: String(walk.steps.length),
    });
    expect(walk.steps.length).toBeGreaterThan(20);
  });
});
