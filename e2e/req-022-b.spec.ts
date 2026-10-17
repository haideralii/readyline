import { test, expect } from "@playwright/test";

/**
 * REQ-022 Session B (FR-7, SR-6), the public face of the unsubscribe link:
 * a malformed token and an unknown well-formed token are a plain 404 with
 * no hint of which it was, on both projects. The click that sets
 * do_not_send needs an account's token and runs on the Supabase job
 * (tests/integration/reminder-settings.test.ts).
 */
test.describe("REQ-022 Session B: the unsubscribe link", () => {
  test("a malformed or unknown token is a plain 404", async ({ page }) => {
    const malformed = await page.goto("/email/unsubscribe/not-a-token");
    expect(malformed?.status()).toBe(404);
    const unknown = await page.goto(`/email/unsubscribe/${"0".repeat(64)}`);
    expect(unknown?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).not.toContainText(
      /Reminder emails stopped/,
    );
  });
});
