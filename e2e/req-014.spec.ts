import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";

/**
 * REQ-014 visual identity v1 on both projects: the serif loads from our
 * own origin (AC-2), the step line and the result line render (AC-3) and
 * reduced motion removes the fill animation, the tokens flip in dark mode,
 * and axe stays clean in both themes. With EVIDENCE=1, light and dark
 * screenshots of home, a questionnaire step, the result, pricing, sign-in
 * and a legal page go to product/evidence/req-014/ (AC-5).
 */
const dir = "product/evidence/req-014";

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
  // Client navigation can set <title> a tick after the heading renders.
  await page.waitForFunction(() => document.title.length > 0);
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

async function toSupports(page: Page) {
  await page.goto("/start/business");
  await page.getByLabel("Trading name").fill("Sunrise Supports");
  await page.getByRole("radio", { name: "Sole trader" }).check();
  await page.getByRole("checkbox", { name: "NSW" }).check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "The supports you deliver" }),
  ).toBeVisible();
}

async function toResult(page: Page) {
  await toSupports(page);
  await page.locator("#group-0120").check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.locator("#restrictivePractices-no").check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.locator("#allRiskAssessedScreened-yes").check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  for (const key of [
    "policies",
    "incidentRegister",
    "complaintsRegister",
    "insuranceCertificate",
    "workerInductionRecords",
  ])
    await page.locator(`#${key}-no`).check();
  await page.getByRole("button", { name: "See my result" }).click();
  await expect(page.getByTestId("result")).toBeVisible();
}

test.describe("REQ-014 visual identity", () => {
  test("fonts come from our origin, the wordmark and tokens render, and nothing external is loaded (AC-1, AC-2)", async ({
    page,
  }) => {
    const external: string[] = [];
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (u.origin !== new URL(page.url() || "http://localhost").origin)
        external.push(r.url());
    });
    await page.goto("/");
    await expect(page.getByTestId("wordmark")).toBeVisible();
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveCSS("font-family", /Fraunces/);
    const bodyBg = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    expect(bodyBg).toBe("rgb(247, 243, 236)");
    expect(external.filter((u) => !u.startsWith("http://localhost"))).toEqual(
      [],
    );
    const csp = (await page.request.get("/")).headers()[
      "content-security-policy"
    ];
    expect(csp).toContain("font-src 'self'");
    expect(csp).not.toContain("fonts.g");
  });

  test("dark mode flips the tokens and stays axe clean", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    const bodyBg = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    expect(bodyBg).toBe("rgb(20, 28, 27)");
    await axeClean(page, "home dark");
  });

  test("the step line and the result line render; reduced motion removes the fill animation (AC-3)", async ({
    page,
  }) => {
    await toSupports(page);
    const fill = page.getByTestId("progress-line-fill");
    await expect(fill).toBeVisible();
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "aria-valuetext",
      "Step 2 of 6: Supports",
    );
    await expect(fill).toHaveCSS("fill", "rgb(180, 70, 31)");
    // R-2: step 2 of 6 fills about a third of the line.
    await expect(fill).toHaveAttribute("width", "33");
    const animated = await fill.evaluate(
      (el) => getComputedStyle(el).animationDuration,
    );
    expect(animated).toBe("0.7s");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    const reduced = await page
      .getByTestId("progress-line-fill")
      .evaluate((el) => getComputedStyle(el).animationDuration);
    // Chromium reports the global 0.01ms rule as "1e-05s"; anything under a frame counts as off.
    expect(parseFloat(reduced)).toBeLessThan(0.01);
    await page.emulateMedia({ reducedMotion: "no-preference" });

    await toResult(page);
    const line = page.getByTestId("result-ready-line");
    await expect(line).toBeVisible();
    await expect(page.getByTestId("result-ready-line-text")).toContainText(
      /\d+ of \d+ documents and registers in place/,
    );
    await expect(page.getByTestId("result-ready-line-to-prepare")).toHaveCSS(
      "fill",
      "rgb(180, 70, 31)",
    );
  });

  test("screenshots: light and dark at the project's viewport (AC-5)", async ({
    page,
  }, testInfo) => {
    test.skip(!process.env.EVIDENCE, "set EVIDENCE=1 to capture screenshots");
    const project = testInfo.project.name;
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/");
      await shot(page, `home-${scheme}`, project);
      await axeClean(page, `home ${scheme}`);
      await page.goto("/pricing");
      await shot(page, `pricing-${scheme}`, project);
      await page.goto("/sign-in");
      await shot(page, `sign-in-${scheme}`, project);
      await page.goto("/terms");
      await shot(page, `terms-${scheme}`, project);
      await toSupports(page);
      await shot(page, `supports-${scheme}`, project);
      await axeClean(page, `supports ${scheme}`);
      await toResult(page);
      await shot(page, `result-${scheme}`, project);
      await axeClean(page, `result ${scheme}`);
    }
  });
});
