import { test, expect } from "@playwright/test";

/**
 * REQ-004 sign-in page (both projects). Without a Supabase stack the action
 * reports that sign-in is unavailable; with one, a request shows the generic
 * "link is on its way" message whether or not the address exists (AC-1).
 * The full magic-link journey through the local inbox runs only in the
 * Supabase CI job (see tests/integration and the supabase-integration job).
 */
test.describe("sign-in", () => {
  test("renders an accessible form and never reveals whether an address exists", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await expect(
      page.getByRole("heading", { level: 1, name: "Sign in" }),
    ).toBeVisible();
    const email = page.getByLabel("Email address");
    await expect(email).toBeVisible();
    // QA live b340ee3 (report B): an email field, so a phone opens the email keyboard.
    await expect(email).toHaveAttribute("type", "email");
    await expect(email).toHaveAttribute("inputmode", "email");
    await expect(email).toHaveAttribute("autocomplete", "email");

    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Please fix" }),
    ).toContainText("Email");

    await email.fill("someone@example.test");
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    const sent = page.getByTestId("magic-link-sent");
    const unavailable = page
      .getByRole("alert")
      .filter({ hasText: "not available in this environment" });
    await expect(sent.or(unavailable)).toBeVisible();
  });

  test("account pages redirect signed-out visitors to sign-in", async ({
    page,
  }) => {
    await page.goto("/account");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount$/);
    await page.goto("/account/setup");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount%2Fsetup$/);
  });

  test("header offers Sign in when signed out", async ({ page }) => {
    await page.goto("/");
    await expect(
      page
        .getByRole("navigation", { name: "Account" })
        .getByRole("link", { name: "Sign in" }),
    ).toBeVisible();
  });
});
