import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { hasSupabaseForE2e } from "../helpers/env";
import {
  createTenant,
  deleteTenant,
  signInContext,
  type TestTenant,
} from "../helpers/session";

/**
 * REQ-028 Session C, FR-11, the account page: from lg a sticky in-page nav
 * over the ten section headings in columns 1 to 3 with the sections in 4
 * to 12, the nav marking the section in view after a jump; under lg no nav
 * and the sections in their order. Needs a Supabase stack.
 */
const enabled = hasSupabaseForE2e();
const answers = JSON.parse(
  readFileSync(
    "fixtures/reference-cases/verification-sole-trader.json",
    "utf8",
  ),
) as Record<string, unknown>;

test.describe("REQ-028 Session C: the account page's in-page nav (FR-11)", () => {
  test.skip(!enabled, "needs the Supabase variables");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  let tenant: TestTenant;

  test.beforeAll(async ({}, testInfo) => {
    tenant = await createTenant({
      label: `req-028-c-${testInfo.project.name}`,
      tradingName: "Sunrise Supports",
      answers,
    });
  });

  test.afterAll(async () => {
    if (tenant) await deleteTenant(tenant);
  });

  test("at 1280 the nav lists the sections in three columns, marks the one jumped to and stays at 6 rem; under lg it is absent", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInContext(context, tenant, baseURL!);
    await page.goto("/account");
    await expect(
      page.getByRole("heading", { level: 1, name: "Your account" }),
    ).toBeVisible();
    const nav = page.getByRole("navigation", { name: "On this page" });
    if ((page.viewportSize()?.width ?? 0) < 1024) {
      await expect(nav).toHaveCount(0);
      return;
    }
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link")).toHaveCount(10);
    const shell = (await page.locator('[data-shell="page"]').boundingBox())!;
    const col = (shell.width - 64 - 11 * 32) / 12;
    const nb = (await page.getByTestId("account-nav").boundingBox())!;
    expect(Math.abs(nb.width - (3 * col + 2 * 32))).toBeLessThanOrEqual(4);
    const sections = (await page
      .getByTestId("account-registers")
      .boundingBox())!;
    expect(sections.x).toBeGreaterThan(nb.x + nb.width);
    await nav.getByRole("link", { name: "Your team" }).click();
    await expect(page).toHaveURL(/#team-heading$/);
    await expect(nav.getByRole("link", { name: "Your team" })).toHaveAttribute(
      "aria-current",
      "location",
    );
    const stuck = (await page.getByTestId("account-nav").boundingBox())!;
    expect(Math.abs(stuck.y - 96)).toBeLessThanOrEqual(2);
  });
});
