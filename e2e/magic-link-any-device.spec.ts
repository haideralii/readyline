import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

/**
 * REQ-004 FR-9 AC: a magic link requested in one browser context and opened
 * in a fresh one lands signed in. The link is produced with the admin API
 * (`generateLink`, the same token hash the email carries) because no test can
 * read a mailbox; the callback then has to verify it in a browser that never
 * saw the request. Needs the three Supabase variables (read from .env.local
 * here when the shell did not set them, never printed); skips otherwise.
 * With EVIDENCE=1 the "link sent" and "link failed" screens are captured.
 */
function loadLocalEnv() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(
      /^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY|SUPABASE_SECRET_KEY)=(.*)$/,
    );
    if (m && !process.env[m[1]]?.trim())
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
loadLocalEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const secret = process.env.SUPABASE_SECRET_KEY?.trim();
const EVIDENCE_DIR = "product/evidence/req-004";

test.describe("magic link works on any device (REQ-004 FR-9)", () => {
  test("a link requested in one context signs in a fresh context", async ({
    browser,
  }) => {
    test.skip(!url || !secret, "needs the Supabase variables");
    const admin = createClient(url!, secret!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const email = `any-device-${randomUUID()}@example.test`;
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    expect(created.error).toBeNull();
    const userId = created.data.user!.id;
    try {
      // Context 1 requests the link (the questionnaire laptop).
      const requesting = await browser.newContext();
      const page1 = await requesting.newPage();
      await page1.goto("/sign-in?next=%2Faccount%2Fsetup");
      // QA live b340ee3, batch C (1), the iphone project: WebKit takes the typing before React
      // has hydrated the controlled input, and hydration then empties it, so the submit found an
      // empty field (the groups search's note). Fill until the value survives, then submit once.
      const emailBox = page1.getByLabel("Email address");
      await expect(async () => {
        await emailBox.fill("");
        await emailBox.fill(email);
        await page1.waitForTimeout(300);
        await expect(emailBox).toHaveValue(email, { timeout: 500 });
      }).toPass({ timeout: 20_000 });
      await page1
        .getByRole("button", { name: "Email me a sign-in link" })
        .click();
      await expect(page1.getByTestId("magic-link-sent")).toContainText(
        /expires in an hour; open it on any device/,
      );
      await requesting.close();

      // The link the email would carry: the token hash from the admin API.
      const link = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });
      expect(link.error).toBeNull();
      const tokenHash = link.data.properties?.hashed_token;
      expect(tokenHash).toBeTruthy();

      // Context 2 (the phone) opens it cold.
      const opening = await browser.newContext();
      const page2 = await opening.newPage();
      await page2.goto(
        `/auth/callback?next=%2Faccount%2Fsetup&token_hash=${tokenHash}&type=magiclink`,
      );
      await expect(page2).toHaveURL(/\/account\/setup$/);
      await expect(page2.getByRole("heading", { level: 1 })).toBeVisible();
      // Signed in: the header offers the account, not sign-in.
      await expect(page2.getByRole("link", { name: "Sign in" })).toHaveCount(0);
      await opening.close();
    } finally {
      await admin.auth.admin.deleteUser(userId);
    }
  });

  test("a bad or reused link lands on the plain failure message, with nothing in the URL but the flag", async ({
    page,
  }, testInfo) => {
    await page.goto(
      "/auth/callback?token_hash=0000000000000000000000000000000000000000&type=magiclink",
    );
    await expect(page).toHaveURL(/\/sign-in\?error=link$/);
    await expect(
      page.getByRole("alert").filter({ hasText: "The link has expired" }),
    ).toContainText("The link has expired or was already used");
    if (process.env.EVIDENCE) {
      mkdirSync(EVIDENCE_DIR, { recursive: true });
      await page.screenshot({
        path: `${EVIDENCE_DIR}/magic-link-failed-${testInfo.project.name}.jpg`,
        fullPage: true,
        type: "jpeg",
        quality: 40,
        scale: "css",
      });
      await page.getByLabel("Email address").fill("someone@example.test");
      await page
        .getByRole("button", { name: "Email me a sign-in link" })
        .click();
      // The "link failed" alert from the URL flag is still on the page; look for the sent
      // status or the "not available" alert only.
      await expect(
        page
          .getByTestId("magic-link-sent")
          .or(
            page
              .getByRole("alert")
              .filter({ hasText: "not available in this environment" }),
          ),
      ).toBeVisible();
      await page.screenshot({
        path: `${EVIDENCE_DIR}/magic-link-sent-${testInfo.project.name}.jpg`,
        fullPage: true,
        type: "jpeg",
        quality: 40,
        scale: "css",
      });
    }
  });
});
