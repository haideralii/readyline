import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { openAllGroups, tickGroup } from "./helpers/groups";
import { openResultSections } from "./helpers/result";

/**
 * REQ-028, "Evidence required on delivery": full-page screenshots of the
 * public routes in both colour schemes at the project's width (360 on
 * `android-small`, 1280 on `desktop-chromium`), and the heights of the
 * supports step (every group open), the result page and the which-audit
 * guide, written under product/evidence/req-028/. Runs only with
 * EVIDENCE=1; EVIDENCE_TAG names the capture ("before" from `next`,
 * "after" from the session's branch, default "after"). The signed-in routes
 * come from the Supabase CI job's EVIDENCE run, not from here.
 *
 *   EVIDENCE=1 EVIDENCE_TAG=after npx playwright test e2e/req-028-evidence.spec.ts
 */
const DIR = "product/evidence/req-028";
const TAG = process.env.EVIDENCE_TAG ?? "after";
const SCHEMES = ["light", "dark"] as const;

const PUBLIC_ROUTES: [name: string, path: string, heading: string | RegExp][] =
  [
    ["home", "/", /./],
    ["pricing", "/pricing", /./],
    ["sample", "/sample", /./],
    ["guide-which-audit", "/guides/which-ndis-audit", /./],
    ["terms", "/terms", /./],
    ["sign-in", "/sign-in", /./],
  ];

async function settled(page: Page, heading: string | RegExp) {
  await expect(
    page.getByRole("heading", { level: 1, name: heading }).first(),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

async function shot(page: Page, name: string, project: string) {
  mkdirSync(DIR, { recursive: true });
  for (const scheme of SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({
      path: `${DIR}/${name}-${TAG}-${scheme}-${project}.jpg`,
      fullPage: true,
      type: "jpeg",
      quality: 35,
      scale: "css",
    });
  }
  await page.emulateMedia({ colorScheme: "light" });
}

const height = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollHeight);

test.describe("REQ-028 evidence (EVIDENCE=1)", () => {
  test.skip(!process.env.EVIDENCE, "set EVIDENCE=1 to capture the evidence");
  test.skip(
    ({ viewport }) => ![360, 1280].includes(viewport?.width ?? 0),
    "360 and 1280 only",
  );

  test("the public routes in both schemes", async ({ page }, testInfo) => {
    test.slow();
    for (const [name, path, heading] of PUBLIC_ROUTES) {
      await page.goto(path);
      await settled(page, heading);
      await shot(page, name, testInfo.project.name);
    }
  });

  test("the questionnaire's six steps, the result and the three heights", async ({
    page,
  }, testInfo) => {
    test.slow();
    const project = testInfo.project.name;
    const heights: Record<string, number> = {};

    await page.goto("/start");
    await settled(page, "Find out what registration needs from you");
    await shot(page, "start-intro", project);

    await page.getByRole("link", { name: "Start the questionnaire" }).click();
    await settled(page, "About your business");
    await shot(page, "step-1-business", project);
    await page.getByLabel("Trading name").fill("Sunrise Supports");
    await page.getByRole("radio", { name: "Sole trader" }).check();
    await page.getByRole("checkbox", { name: "NSW" }).check();
    await page.getByRole("button", { name: "Save and continue" }).click();

    await settled(page, "The supports you deliver");
    await tickGroup(page, "0138");
    await tickGroup(page, "0107");
    await shot(page, "step-2-supports", project);
    await openAllGroups(page);
    heights.supportsAllOpen = await height(page);
    await page.locator("#silEligibility\\.fewHoursOnly-no").check();
    await page
      .locator("#silEligibility\\.participantManagesOwnWorkers-no")
      .check();
    await page.getByRole("button", { name: "Save and continue" }).click();

    await settled(page, "Restrictive practices");
    await page.locator("#restrictivePractices-not-sure").check();
    await expect(page.getByTestId("not-sure-helper")).toBeVisible();
    await shot(page, "step-3-practices", project);
    await page.locator("#notSureHelper\\.locksOrBarriers-yes").check();
    await page.locator("#notSureHelper\\.holdsOrRestraint-no").check();
    await page.locator("#notSureHelper\\.medicationForBehaviour-no").check();
    await page.getByRole("button", { name: "Save and continue" }).click();

    await settled(page, "Your workforce");
    await page.getByLabel("Number of workers").fill("4");
    await page.getByLabel("Number of key personnel").fill("1");
    await page.locator("#hasRiskAssessedRoles-yes").check();
    await page.locator("#allRiskAssessedScreened-no").check();
    await shot(page, "step-4-workforce", project);
    await page.getByRole("button", { name: "Save and continue" }).click();

    await settled(page, "What you already have");
    for (const key of [
      "policies",
      "incidentRegister",
      "complaintsRegister",
      "insuranceCertificate",
      "workerInductionRecords",
    ]) {
      await page.locator(`#${key}-not-sure`).check();
    }
    await shot(page, "step-5-already-have", project);
    await page.getByRole("button", { name: "See my result" }).click();

    await expect(page.getByTestId("result")).toBeVisible();
    await settled(page, "Your result");
    await shot(page, "step-6-result", project);
    await openResultSections(page);
    await shot(page, "step-6-result-open", project);
    heights.resultOpen = await height(page);

    await page.goto("/guides/which-ndis-audit");
    await settled(page, /./);
    heights.guideWhichAudit = await height(page);

    mkdirSync(DIR, { recursive: true });
    writeFileSync(
      `${DIR}/heights-${TAG}-${project}.json`,
      JSON.stringify(
        {
          width: page.viewportSize()?.width,
          ...heights,
          measuredAt: new Date().toISOString(),
        },
        null,
        2,
      ) + "\n",
    );
  });
});
