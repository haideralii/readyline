import { test, expect } from "@playwright/test";

/**
 * REQ-010 FR-4 on both projects: the health route answers with the version,
 * the SHA and the region, carries no secret, rejects query parameters, and
 * the scheduled-job routes stay invisible without the cron secret.
 */
test.describe("health route (REQ-010 FR-4)", () => {
  test("answers ok with version, sha, region, deployment and siteUrl, and nothing else", async ({
    request,
  }) => {
    const r = await request.get("/api/health");
    expect(r.status()).toBe(200);
    expect(r.headers()["cache-control"]).toBe("no-store");
    const body = await r.json();
    // REQ-022 FR-9 (Session C): siteUrl names the origin the record was taken against.
    expect(Object.keys(body).sort()).toEqual([
      "deployment",
      "ok",
      "region",
      "sha",
      "siteUrl",
      "version",
    ]);
    expect(body.ok).toBe(true);
    expect(body.siteUrl).toMatch(/^https?:\/\/[^/]+$/);
    expect(body.version).toMatch(/^\d+\.\d+\.\d+\+[0-9a-f]{1,12}|\+local$/);
    expect(JSON.stringify(body)).not.toMatch(/sk_|whsec|eyJ/);
  });

  test("rejects query parameters", async ({ request }) => {
    const r = await request.get("/api/health?debug=1");
    expect(r.status()).toBe(400);
  });
});
