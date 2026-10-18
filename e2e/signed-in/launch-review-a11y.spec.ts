import { test, expect, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { hasSupabaseForE2e } from "../helpers/env";
import { gotoSettled } from "../helpers/a11y";
import {
  A11Y_RULINGS,
  A11Y_TAGS,
  A11Y_WIDTHS,
  SCHEMES,
  violationLines,
} from "../helpers/launch-review-a11y";
import {
  createLaunchReviewTenants,
  deleteLaunchReviewTenants,
  OWNER_PAGES,
  WORKER_PAGES,
  type LaunchReviewTenants,
} from "../helpers/launch-review-tenants";
import { signInContext } from "../helpers/session";
import { setTextZoom } from "../helpers/width";

/**
 * REQ-012 FR-3a (AC-7; D-2912), the signed-in routes, in the Supabase job
 * with throwaway tenants (SR-2): a subscribed owner over the checklist, the
 * documents page, the account page, every register list and its new form,
 * the audit-day, before-you-buy and renewal pages; the audit pack view
 * through a seeded auditor link; the worker home and the worker's two forms
 * through a worker member; the invite and report pages through seeded
 * tokens. Same matrix as the public spec (three widths on the desktop
 * project, the project's own width on the phones; both schemes; 200 % text
 * at the first width); zero violations of any impact, or a ruling by rule
 * id. The set and its Start here page are covered in the guided-path spec,
 * the one with a purchased set. Every violation is collected and attached
 * once at the end, whatever the outcome.
 */
const enabled = hasSupabaseForE2e();

type Sweep = { lines: string[]; problems: string[] };

async function axe(page: Page, label: string, sweep: Sweep) {
  const results = await new AxeBuilder({ page })
    .withTags([...A11Y_TAGS])
    .analyze();
  const unruled = results.violations.filter((v) => !(v.id in A11Y_RULINGS));
  for (const line of violationLines(unruled))
    sweep.problems.push(`${label}: ${line}`);
  const ids = results.violations.map((v) => v.id);
  sweep.lines.push(`${label}: ${ids.length ? ids.join(",") : "clean"}`);
}

async function matrix(
  page: Page,
  path: string,
  widths: readonly number[],
  sweep: Sweep,
  schemes: readonly ("light" | "dark")[] = SCHEMES,
  textZoom = true,
) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const scheme of schemes) {
      await page.emulateMedia({ colorScheme: scheme });
      await gotoSettled(page, path);
      await axe(page, `${path} @${width} ${scheme}`, sweep);
      if (textZoom && width === widths[0]) {
        await setTextZoom(page, 200);
        await axe(page, `${path} @${width} ${scheme} text 200%`, sweep);
        await setTextZoom(page, null);
      }
    }
  }
  await page.emulateMedia({ colorScheme: "light" });
}

const isDesktop = (testInfo: TestInfo) =>
  testInfo.project.name === "desktop-chromium";

const widthsFor = (testInfo: TestInfo) =>
  isDesktop(testInfo)
    ? A11Y_WIDTHS
    : [testInfo.project.use.viewport?.width ?? 1280];

// D-2983's run (#125, 39151292700) put the signed-in step at 49 minutes: the
// phone projects take the public sweep's sampling rule (D-2348 (1)): one pass at
// their own width in the light scheme over the owner pages; the desktop project
// carries the whole matrix (three widths, both schemes, 200 % text).
const schemesFor = (testInfo: TestInfo) =>
  isDesktop(testInfo) ? SCHEMES : (["light"] as const);

async function run(
  page: Page,
  testInfo: TestInfo,
  name: string,
  paths: string[],
) {
  const sweep: Sweep = { lines: [], problems: [] };
  const widths = widthsFor(testInfo);
  const schemes = schemesFor(testInfo);
  try {
    for (const path of paths)
      await matrix(page, path, widths, sweep, schemes, isDesktop(testInfo));
  } finally {
    await testInfo.attach(`axe-signed-in-${name}.txt`, {
      body: [
        `WCAG 2.2 AA (tags ${A11Y_TAGS.join(", ")}); project ${testInfo.project.name}; widths ${widths.join("/")}; schemes ${schemes.join("/")}; text 200 % ${isDesktop(testInfo) ? "yes" : "no"}`,
        ...sweep.lines,
        "",
        ...sweep.problems,
      ].join("\n"),
      contentType: "text/plain",
    });
  }
  expect(
    sweep.problems,
    `${name}: axe violations at WCAG 2.2 AA not ruled by rule id`,
  ).toEqual([]);
}

test.describe("launch review: axe at WCAG 2.2 AA on every signed-in route (REQ-012 FR-3a, AC-7)", () => {
  test.skip(!enabled, "needs the Supabase variables");
  test.describe.configure({ mode: "serial", timeout: 900_000 });

  let t: LaunchReviewTenants;

  test.beforeAll(async ({}, testInfo) => {
    t = await createLaunchReviewTenants(testInfo, "a11y");
  });

  test.afterAll(async () => {
    await deleteLaunchReviewTenants(t);
  });

  test("owner: the checklist, documents, account, every register list and form, the path pages", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    await signInContext(context, t.owner, baseURL!);
    await run(page, testInfo, "owner", OWNER_PAGES);
  });

  test("auditor: the shared audit view through a live link, signed out", async ({
    page,
  }, testInfo) => {
    test.skip(
      !isDesktop(testInfo),
      "D-2985: the phones sample the owner pages alone",
    );
    await run(page, testInfo, "auditor", [`/auditor/${t.auditorToken}`]);
  });

  test("worker: the worker home and the two forms", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    test.skip(
      !isDesktop(testInfo),
      "D-2985: the phones sample the owner pages alone",
    );
    await signInContext(context, t.worker, baseURL!);
    await run(page, testInfo, "worker", WORKER_PAGES);
  });

  test("tokens: the invite page and the report form, signed out", async ({
    page,
  }, testInfo) => {
    test.skip(
      !isDesktop(testInfo),
      "D-2985: the phones sample the owner pages alone",
    );
    await run(page, testInfo, "tokens", [
      `/invite/${t.inviteToken}`,
      `/report/${t.reportToken}`,
    ]);
  });
});
