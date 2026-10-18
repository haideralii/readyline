import { test, expect } from "@playwright/test";

/**
 * QA live b340ee3, report B #57 (medium): the unknown-token routes and
 * `/admin` signed out serve the 404 page, and the tab title must stay
 * "Page not found" after hydration too; before the fix the RSC payload
 * carried the route's own static title ("Reminder emails stopped", "Report
 * an incident", "Shared audit view", "Your invitation", "Admin") and the
 * browser swapped it in. Desktop only (D-2207): the title is the same on
 * every width.
 */
const ROUTES = [
  "/email/unsubscribe/not-a-real-token",
  `/email/unsubscribe/${"0".repeat(64)}`,
  "/report/not-a-real-token",
  `/auditor/${"0".repeat(64)}`,
  "/invite/not-a-real-token",
  "/admin",
];
const PRIVATE_TITLES =
  /Reminder emails stopped|Report an incident|Shared audit view|Your invitation|^Admin/;

test.describe("the 404 title follows notFound() (QA live B #57)", () => {
  for (const path of ROUTES) {
    test(`${path} keeps "Page not found" in the tab after hydration`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "desktop-chromium",
        "the title is the same on every width",
      );
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        "That page is not here.",
      );
      // Hydration: the client has applied the RSC payload's metadata by the time the network is quiet.
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);
      const title = await page.title();
      expect(title, path).toMatch(/^Page not found \| /);
      expect(title, path).not.toMatch(PRIVATE_TITLES);
    });
  }
});
