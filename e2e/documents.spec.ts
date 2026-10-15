import { test, expect } from "@playwright/test";

/**
 * REQ-005 Session C (both projects): the documents pages and the download
 * route need a session; without one they redirect to sign-in or answer 404.
 * The signed-in flow runs in the Supabase CI job's integration suite.
 */
test.describe("documents", () => {
  test("documents pages redirect signed-out visitors to sign-in", async ({
    page,
  }) => {
    await page.goto("/documents");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fdocuments$/);
    await page.goto("/documents/11111111-1111-4111-8111-111111111111");
    // Batch 47 item 7 and batch 48 item 3: a page comes back to itself after sign-in.
    await expect(page).toHaveURL(
      /\/sign-in\?next=%2Fdocuments%2F11111111-1111-4111-8111-111111111111$/,
    );
  });

  test("the download route redirects signed-out visitors and rejects bad file names", async ({
    request,
  }) => {
    const ok = await request.get(
      "/documents/11111111-1111-4111-8111-111111111111/download?file=set.zip",
      {
        maxRedirects: 0,
      },
    );
    expect(ok.status()).toBe(307);
    // Batch 48 item 3: a download route comes back to its document's page, never to the file.
    expect(ok.headers()["location"]).toMatch(
      /\/sign-in\?next=%2Fdocuments%2F11111111-1111-4111-8111-111111111111$/,
    );
    const bad = await request.get(
      "/documents/11111111-1111-4111-8111-111111111111/download?file=../x.zip",
      {
        maxRedirects: 0,
      },
    );
    expect(bad.status()).toBe(404);
  });
});
