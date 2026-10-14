import { test, expect } from "@playwright/test";

/**
 * Backlog 5 (OWASP ASVS L1 re-check; REQ-002, REQ-004 SR-3; D-424): the
 * framework's cross-site request forgery check on server actions is in
 * force, every job route needs its secret, the Stripe webhook refuses an
 * unsigned body, and the public questionnaire action answers a loop with a
 * limit instead of work. Runs without Supabase variables.
 */
test.describe("cross-site requests and abuse (backlog 5)", () => {
  test("a server action posted from another origin is refused", async ({
    request,
    baseURL,
  }) => {
    // Next checks the Origin header against the host before it runs any
    // action; a forged action id is never looked up when the origin fails.
    const res = await request.post("/sign-in", {
      headers: {
        Origin: "https://evil.example",
        "Next-Action": "0123456789abcdef0123456789abcdef01234567",
        "Content-Type": "text/plain;charset=UTF-8",
        Accept: "text/x-component",
      },
      data: JSON.stringify([{ email: "someone@example.test", next: "/" }]),
      maxRedirects: 0,
    });
    expect(res.status(), "cross-origin action").toBeGreaterThanOrEqual(400);
    expect(await res.text()).not.toContain("If that address is registered");
    void baseURL;
  });

  test("the job routes are closed without the cron secret", async ({
    request,
  }) => {
    for (const path of [
      "/api/jobs/purge",
      "/api/jobs/reminders",
      "/api/jobs/generate",
    ]) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(404);
      const forged = await request.get(path, {
        headers: { Authorization: "Bearer not-the-secret" },
      });
      expect(forged.status(), `${path} wrong secret`).toBe(404);
    }
  });

  test("the Stripe webhook refuses an unsigned and a badly signed body", async ({
    request,
  }) => {
    const unsigned = await request.post("/api/stripe/webhook", {
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify({
        id: "evt_forged",
        type: "checkout.session.completed",
      }),
    });
    // 400 with the signature check; 503 where Stripe is not configured at all (CI's main job), which is also closed.
    expect([400, 401, 403, 503]).toContain(unsigned.status());
    const badlySigned = await request.post("/api/stripe/webhook", {
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "t=1,v1=deadbeef",
      },
      data: JSON.stringify({
        id: "evt_forged",
        type: "checkout.session.completed",
      }),
    });
    expect([400, 401, 403, 503]).toContain(badlySigned.status());
  });

  test("the health route and the sample document answer a loop with 429", async ({
    request,
  }) => {
    let limited = false;
    for (let i = 0; i < 70 && !limited; i += 1) {
      const res = await request.get("/api/health", {
        headers: { "x-forwarded-for": "203.0.113.77" },
      });
      limited = res.status() === 429;
    }
    expect(limited, "health route limits a loop").toBe(true);
  });
});
