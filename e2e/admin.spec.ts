import { test, expect } from "@playwright/test";

/**
 * REQ-004 AC-7 and FR-6 (both projects): admin routes do not exist for
 * anyone who is not a signed-in platform admin, the purge route is invisible
 * without the cron secret, and the export needs a session.
 */
test.describe("admin and job routes", () => {
  test("admin pages are 404 for anonymous visitors", async ({ page }) => {
    for (const path of ["/admin", "/admin/mfa", "/admin/launch"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
    }
  });

  test("the purge route is 404 without the cron secret", async ({
    request,
  }) => {
    const none = await request.get("/api/jobs/purge");
    expect(none.status()).toBe(404);
    const wrong = await request.get("/api/jobs/purge", {
      headers: { Authorization: "Bearer not-the-secret-value" },
    });
    expect(wrong.status()).toBe(404);
  });

  test("export redirects signed-out visitors to sign-in", async ({ page }) => {
    await page.goto("/account/export");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount$/);
  });

  test("the account-deleted page renders without a session", async ({
    page,
  }) => {
    await page.goto("/account/deleted");
    await expect(
      page.getByRole("heading", { level: 1, name: "Your account was deleted" }),
    ).toBeVisible();
    // Retro review of REQ-004 (15 Oct 2026, fix 31a): no email leaves the
    // app while the provider is log-only (D-013), so the page must not say
    // one was sent or ask the customer to reply to it.
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/has been sent|confirmation email|reply to/i);
    expect(body).toMatch(/If this was a mistake/);
  });
});
