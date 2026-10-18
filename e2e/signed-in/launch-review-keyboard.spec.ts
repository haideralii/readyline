import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { hasSupabaseForE2e } from "../helpers/env";
import { gotoSettled } from "../helpers/a11y";
import { keyboardPass } from "../helpers/keyboard-pass";
import {
  createLaunchReviewTenants,
  deleteLaunchReviewTenants,
  REGISTERS,
  WORKER_PAGES,
  type LaunchReviewTenants,
} from "../helpers/launch-review-tenants";
import { signInContext } from "../helpers/session";

/**
 * REQ-012 FR-3b (AC-8), the signed-in half, in the Supabase job with
 * throwaway tenants (SR-2): the account page, every register list and its
 * new form, and the worker home walked with the keyboard alone. Every
 * focusable element reached by Tab in document order with a visible ring,
 * no trap, each disclosure opened with Enter and closed again (an overlay
 * closing on Escape). The trail of every page is attached.
 */
const enabled = hasSupabaseForE2e();

const OWNER_KEYBOARD = [
  "/account",
  "/registers",
  ...REGISTERS.flatMap((r) => [`/registers/${r}`, `/registers/${r}/new`]),
];

async function walk(
  page: Page,
  testInfo: TestInfo,
  name: string,
  paths: string[],
) {
  const lines: string[] = [];
  const missed: string[] = [];
  try {
    for (const path of paths) {
      await gotoSettled(page, path);
      await page
        .waitForFunction(
          () => !document.querySelector("fieldset:disabled"),
          undefined,
          { timeout: 15_000 },
        )
        .catch(() => undefined);
      const pass = await keyboardPass(page, path);
      lines.push(
        `${path}: ${pass.trail.length} stops, ${pass.toggled.length} toggled, ${pass.missed.length} missed`,
      );
      for (const m of pass.missed) console.log(`${path}: missed ${m}`);
      for (const m of pass.missed) missed.push(`${path}: ${m}`);
      expect(
        pass.trail.length,
        `${path}: the walk reached the page's controls`,
      ).toBeGreaterThan(2);
    }
  } finally {
    await testInfo.attach(`keyboard-signed-in-${name}.txt`, {
      body: [...lines, "", ...missed].join("\n"),
      contentType: "text/plain",
    });
  }
  expect(missed, `${name}: focusable elements Tab never reached`).toEqual([]);
}

test.describe("launch review: the keyboard pass on the signed-in pages (REQ-012 FR-3b, AC-8)", () => {
  test.skip(!enabled, "needs the Supabase variables");
  test.describe.configure({ mode: "serial", timeout: 900_000 });

  let t: LaunchReviewTenants;

  test.beforeAll(async ({}, testInfo) => {
    t = await createLaunchReviewTenants(testInfo, "kb");
  });

  test.afterAll(async () => {
    await deleteLaunchReviewTenants(t);
  });

  test("owner: the account page, every register list and form", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    await signInContext(context, t.owner, baseURL!);
    await walk(page, testInfo, "owner", OWNER_KEYBOARD);
  });

  test("worker: the worker home and the two forms", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    await signInContext(context, t.worker, baseURL!);
    await walk(page, testInfo, "worker", WORKER_PAGES);
  });
});
