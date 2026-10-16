import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { checkWidths } from "./helpers/width";

/**
 * REQ-021: the writing indicator on the scripted feed (fake Stripe mode;
 * `/dev/writing-indicator`), on all three projects. S1 the phases in order
 * and the counter never going backwards; S2 the refresh on return with the
 * away sentence; S3 the quiet feed (pen lifts, copy); S4 a document that
 * needs another go; S6 the Ready state at once with no movement; S7 the
 * reconnecting dot and the offline line; S9 reduced motion; S10 the live
 * region; width at 360 px; axe. Screenshots of the five phases under
 * product/evidence/req-021/ with EVIDENCE=1.
 */
const dir = "product/evidence/req-021";
/** The test page exists in fake Stripe mode only (404 otherwise); probed once rather than guessed from variables. */
let fakeMode: boolean | null = null;

async function shot(page: Page, name: string, project: string) {
  if (!process.env.EVIDENCE) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({
    path: `${dir}/${name}-${project}.jpg`,
    fullPage: false,
    type: "jpeg",
    quality: 45,
    scale: "css",
  });
}

async function axeClean(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(
    serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes)`),
    label,
  ).toEqual([]);
}

const indicator = (page: Page) => page.getByTestId("writing-indicator");

test.describe("the writing indicator (REQ-021)", () => {
  test.describe.configure({ timeout: 120_000 });
  test.beforeEach(async ({ request }) => {
    if (fakeMode === null) {
      const probe = await request.get(
        "/api/dev/writing-status?scenario=ready&t0=1",
      );
      fakeMode = probe.status() === 200;
    }
    test.skip(
      !fakeMode,
      "needs fake Stripe mode (the test page is 404 otherwise)",
    );
  });

  test("S1: the five phases in order, the counter never going backwards, the list in set order", async ({
    page,
  }, testInfo) => {
    // The script starts a few seconds ahead so a slow first compile still lands on "preparing".
    const t0 = Date.now() + 6000;
    await page.goto(`/dev/writing-indicator?scenario=happy&t0=${t0}`);
    await expect(indicator(page)).toHaveAttribute("data-phase", "preparing");
    await expect(page.getByTestId("wi-line")).toHaveText(
      "Getting your answers ready.",
    );
    await shot(page, "phase-1-preparing", testInfo.project.name);
    await checkWidths(page, "writing indicator");
    await axeClean(page, "preparing");

    await expect(indicator(page)).toHaveAttribute("data-phase", "writing", {
      timeout: 15_000,
    });
    await expect(page.getByTestId("wi-line")).toContainText(
      /^Writing document 1 of \d+: .+, section \d of \d\.$/,
    );
    await expect(indicator(page)).toHaveAttribute("data-moving", "true");
    await expect(
      page.getByTestId("wi-list").locator("li").first(),
    ).toHaveAttribute("data-state", "current");
    await shot(page, "phase-2-writing", testInfo.project.name);

    await expect(indicator(page)).toHaveAttribute("data-phase", "checking", {
      timeout: 15_000,
    });
    await expect(page.getByTestId("wi-line")).toHaveText(
      "Checking it against our rules.",
    );
    await shot(page, "phase-3-checking", testInfo.project.name);

    await expect(indicator(page)).toHaveAttribute("data-phase", "assembling", {
      timeout: 15_000,
    });
    await expect(page.getByTestId("wi-line")).toHaveText(
      "Putting your files together.",
    );
    await shot(page, "phase-4-assembling", testInfo.project.name);

    // The second document: the counter moved to 1 and the first item is written.
    await expect(page.getByTestId("wi-counter")).toHaveText(
      /^1 of \d+ written\.$/,
      {
        timeout: 15_000,
      },
    );
    await expect(
      page.getByTestId("wi-list").locator("li").first(),
    ).toHaveAttribute("data-state", "written");
    // The counter never goes backwards over a few polls.
    let last = 1;
    for (let i = 0; i < 4; i += 1) {
      await page.waitForTimeout(1200);
      const text = await page.getByTestId("wi-counter").textContent();
      const n = Number(/^(\d+) of/.exec(text ?? "")?.[1] ?? "0");
      expect(n).toBeGreaterThanOrEqual(last);
      last = n;
    }
    // The live region never carries a section number (S10).
    expect(await page.getByTestId("wi-live").textContent()).not.toMatch(
      /section \d/,
    );
  });

  test("S6 and AC-3: the Ready state renders at once with no movement, the next step first and Download second", async ({
    page,
  }, testInfo) => {
    await page.goto("/dev/writing-indicator?scenario=ready&t0=1");
    await expect(indicator(page)).toHaveAttribute("data-phase", "ready");
    await expect(indicator(page)).toHaveAttribute("data-moving", "false");
    await expect(page.getByTestId("wi-heading")).toHaveText(
      /^Your \d+ documents are ready\.$/,
    );
    const ready = page.getByTestId("wi-ready");
    await expect(ready.getByTestId("wi-next-step")).toHaveClass(/btn-primary/);
    await expect(ready.getByTestId("wi-next-step")).toContainText(
      "Finish your pack",
    );
    await expect(ready.getByTestId("wi-download")).toHaveClass(/btn-secondary/);
    await expect(ready).toContainText("nothing is lost if you close this page");
    // S10: the heading takes focus.
    await expect(page.getByTestId("wi-heading")).toBeFocused();
    await expect(page.getByTestId("wi-list")).toHaveCount(0);
    await checkWidths(page, "ready");
    await axeClean(page, "ready");
    await shot(page, "phase-5-ready", testInfo.project.name);
  });

  // AC-4's keyboard walk (retro review of REQ-021, finding 42): from the
  // focused heading, the first Tab lands on the next step and the second on
  // Download, so the order of the two actions holds for the keyboard as it
  // does for the eye (AC-3). Headless WebKit does not move keyboard focus
  // onto links at all (home.spec.ts), so the walk runs on the two Chromium
  // projects; the iphone project keeps the focus-on-heading check above.
  test("AC-4: Tab from the ready heading reaches the next step first and Download second", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === "webkit", "WebKit does not tab to links");
    await page.goto("/dev/writing-indicator?scenario=ready&t0=1");
    await expect(indicator(page)).toHaveAttribute("data-phase", "ready");
    await expect(page.getByTestId("wi-heading")).toBeFocused();
    const ready = page.getByTestId("wi-ready");
    await page.keyboard.press("Tab");
    await expect(ready.getByTestId("wi-next-step")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(ready.getByTestId("wi-download")).toBeFocused();
    // Back the same way: Shift+Tab returns to the next step.
    await page.keyboard.press("Shift+Tab");
    await expect(ready.getByTestId("wi-next-step")).toBeFocused();
  });

  test("S3: a quiet feed stops the animation within the rule and says so; a long one says the page can be closed", async ({
    page,
  }, testInfo) => {
    await page.goto("/dev/writing-indicator?scenario=quiet&t0=1");
    await expect(indicator(page)).toHaveAttribute("data-phase", "writing");
    await expect(indicator(page)).toHaveAttribute("data-quiet", "quiet");
    await expect(indicator(page)).toHaveAttribute("data-moving", "false");
    await expect(page.getByTestId("wi-line")).toHaveText(
      /^Still working on .+; this one is taking longer\.$/,
    );
    // The pen has lifted: the paused rule applies to the icon too.
    await expect(page.locator(".wi-icon")).toHaveAttribute(
      "data-moving",
      "false",
    );
    await shot(page, "quiet", testInfo.project.name);
    await page.goto("/dev/writing-indicator?scenario=long&t0=1");
    await expect(indicator(page)).toHaveAttribute("data-quiet", "long");
    await expect(page.getByTestId("wi-line")).toContainText(
      "Taking longer than usual. You can close this page",
    );
  });

  test("S2: coming back to a hidden page refreshes at once and says what happened meanwhile", async ({
    page,
  }) => {
    // Start late in the script so the count moves while the page is "hidden".
    const t0 = Date.now() - 1000;
    await page.goto(
      `/dev/writing-indicator?scenario=happy&t0=${t0}&pollMs=1000`,
    );
    await expect(indicator(page)).toHaveAttribute(
      "data-phase",
      /writing|preparing/,
    );
    // The listener exists only once the component is live; WebKit hydrates late.
    await expect(indicator(page)).toHaveAttribute("data-hydrated", "true");
    // The override sits on the prototype: WebKit ignores a redefinition on the instance.
    await page.evaluate(() => {
      Object.defineProperty(Document.prototype, "hidden", {
        configurable: true,
        get: () => true,
      });
      Object.defineProperty(Document.prototype, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    // Two documents' worth of the script passes while hidden (6 s each).
    await page.waitForTimeout(13_500);
    await page.evaluate(() => {
      Object.defineProperty(Document.prototype, "hidden", {
        configurable: true,
        get: () => false,
      });
      Object.defineProperty(Document.prototype, "visibilityState", {
        configurable: true,
        get: () => "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(page.getByTestId("wi-away")).toHaveText(
      /^While you were away we wrote \d+ more; \d+ of \d+ done\.$/,
      { timeout: 5000 },
    );
  });

  test("S4: a document that needs another go splits the counter and offers Try again for that document only", async ({
    page,
  }, testInfo) => {
    await page.goto("/dev/writing-indicator?scenario=failed&t0=1");
    await expect(indicator(page)).toHaveAttribute("data-phase", "attention");
    await expect(page.getByTestId("wi-counter")).toHaveText(
      /^\d+ written, 1 needs another go, 0 waiting\.$/,
    );
    const failed = page.getByTestId("wi-failed");
    await expect(
      failed.locator("li").filter({ has: page.getByRole("button") }),
    ).toHaveCount(1);
    await expect(
      failed.getByRole("button", { name: "Try again" }),
    ).toBeVisible();
    await expect(
      failed.getByRole("button", { name: "Continue without it" }),
    ).toBeVisible();
    await expect(
      page.getByTestId("wi-list").locator('li[data-state="failed"]'),
    ).toHaveCount(1);
    await expect(indicator(page)).toHaveAttribute("data-moving", "false");
    await checkWidths(page, "attention");
    await axeClean(page, "attention");
    await shot(page, "attention", testInfo.project.name);
  });

  test("S7: when the status request fails the last state stays with a reconnecting dot, then the offline line", async ({
    page,
  }) => {
    await page.goto("/dev/writing-indicator?scenario=offline&t0=1");
    await expect(page.getByTestId("wi-reconnecting")).toContainText(
      "Reconnecting",
      {
        timeout: 5000,
      },
    );
    await expect(page.getByTestId("wi-line")).toContainText("Still working on");
    await expect(page.getByTestId("wi-reconnecting")).toContainText(
      "We cannot reach the server right now; your pack keeps being written.",
      { timeout: 10_000 },
    );
    await expect(indicator(page)).toHaveAttribute("data-offline", "true");
  });

  test("S9: reduced motion shows no movement while writing", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    // Writing starts 2 s into the script and lasts 4 s; land just inside it so both samples fall in the same phase.
    const t0 = Date.now() - 2200;
    await page.goto(`/dev/writing-indicator?scenario=happy&t0=${t0}`);
    await expect(indicator(page)).toHaveAttribute("data-phase", "writing", {
      timeout: 10_000,
    });
    await expect(indicator(page)).toHaveAttribute("data-moving", "true");
    const nib = page.locator(".wi-pen");
    const a = await nib.evaluate((el) => getComputedStyle(el).transform);
    await page.waitForTimeout(800);
    // The pen moves between phases by design; the rule under test is "no movement within a phase".
    await expect(indicator(page)).toHaveAttribute("data-phase", "writing");
    const b = await nib.evaluate((el) => getComputedStyle(el).transform);
    expect(a).toBe(b);
    const line = page.locator(".wi-line").first();
    expect(
      await line.evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("none");
  });

  // D-2006 (batch 45, backlog 10): Lighthouse cannot measure the idle cost of
  // one state, so the Writing phase's animation is measured with the
  // devtools protocol on the Android project: main-thread task time over
  // ten seconds, under half a second.
  test("D-2006: the Writing animation costs the main thread under 0.5 s in 10 s (android-small)", async ({
    page,
    browserName,
  }, testInfo) => {
    test.skip(
      browserName !== "chromium" || testInfo.project.name !== "android-small",
      "the devtools protocol is Chromium's; the budget is the phone's",
    );
    // The steady scenario stays in Writing with fresh progress, so the pen
    // moves for as long as the measurement runs.
    await page.goto(`/dev/writing-indicator?scenario=steady&t0=${Date.now()}`);
    await expect(indicator(page)).toHaveAttribute("data-phase", "writing");
    await expect(indicator(page)).toHaveAttribute("data-moving", "true");
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Performance.enable");
    const task = async () => {
      const { metrics } = (await cdp.send("Performance.getMetrics")) as {
        metrics: { name: string; value: number }[];
      };
      return metrics.find((m) => m.name === "TaskDuration")?.value ?? 0;
    };
    const before = await task();
    await page.waitForTimeout(10_000);
    const after = await task();
    await expect(indicator(page)).toHaveAttribute("data-phase", "writing");
    const seconds = after - before;
    testInfo.annotations.push({
      type: "cpu",
      description: `Writing phase: ${seconds.toFixed(3)} s of main-thread tasks in 10 s`,
    });
    expect(
      seconds,
      "main-thread task time over 10 s of the Writing phase",
    ).toBeLessThan(0.5);
  });
});
