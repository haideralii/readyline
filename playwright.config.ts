import { defineConfig, devices } from "@playwright/test";
import { e2eCronSecret, loadLocalEnv } from "./e2e/helpers/env";

const PORT = Number(process.env.PORT ?? 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;
const isCI = Boolean(process.env.CI);

// The signed-in specs need the Supabase values; read inside Node from .env.local locally (REQ-007 AC-1).
loadLocalEnv();

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  // Backlog 4 flake triage: no blanket retries. A spec earns a retry only
  // where it documents a real race it cannot wait out (the signed-in specs
  // that depend on the Stripe webhook and the job route landing in order);
  // every WebKit race found so far is handled in the test (gotoSettled,
  // the tap and fill retries, endOfPage), so a red run means a real defect.
  retries: 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    // With retries at 0, "on-first-retry" never records anything; CI keeps
    // the trace and a screenshot of every failed test in the uploaded report
    // (run 38665790472 had no trace to read).
    trace: isCI ? "retain-on-failure" : "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Budget Android phone: 360px-wide viewport, touch, mobile Chrome UA.
      // Many providers fill the questionnaire on a phone like this.
      name: "android-small",
      use: {
        ...devices["Galaxy S9+"],
        viewport: { width: 360, height: 740 },
      },
    },
    {
      // REQ-015 FR-16a: iOS Safari had never been tested. WebKit with the
      // descriptor of Haider's own phone (an iPhone 17 Pro, the newest in
      // Playwright's list), on the specs that cover the width check, the
      // home page, the result, the checklist and the purchase path.
      name: "iphone",
      use: { ...devices["iPhone 17 Pro"] },
      // Backlog 1 (D-1508): the accessibility pass runs on all three projects;
      // batch 45 item 28: so does the setup form a new customer submits.
      // QA live b340ee3, batch C (1) (PO 18 Oct 2026 12:20): the nine flows report D found on
      // desktop and Android alone join: the subscription states, REQ-023 B, C and D, the REQ-028
      // register pages and account nav, and the magic-link spec; D-2207 no longer keeps REQ-023 off WebKit.
      testMatch:
        /(req-015-width|req-015-a11y|req-015-accessibility-pass|home-v2|home|req-013-p2|questionnaire|guides|writing-indicator|req-025|req-025-b|req-027|not-found|subscription-story|business-identity|signed-in[\\/](account-setup|checklist|purchase-flow|registers|guided-path|accessibility-pass|audit-day-registers|generation-off|admin-launch|records|audit-pack|team|worker-onboarding|worker-exception|worker-exports|worker-steps|worker-supervision|subscription|req-023-b|req-023-c|req-023-d|req-028-b|req-028-c|magic-link-any-device))\.spec\.ts$/,
    },
  ],
  webServer: {
    // CI runs the production build (npm run build happens in the workflow first).
    // Locally, reuse an already-running dev server if there is one.
    command: isCI ? "npm run start" : "npm run dev",
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    // The server refuses to start without the required variables (src/lib/env.ts).
    env: {
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? baseURL,
      // REQ-007: display pricing for the pricing-page spec; real values live in Vercel.
      PACK_PRICE_AUD_CENTS: process.env.PACK_PRICE_AUD_CENTS ?? "39900",
      GST_LINE:
        process.env.GST_LINE ??
        "No GST while Readyline is not registered for GST.",
      SUBSCRIPTION_PRICE_AUD_CENTS:
        process.env.SUBSCRIPTION_PRICE_AUD_CENTS ?? "3900",
      // REQ-007 AC-1 (D-709): Checkout is the fake page; the webhook secret is the local one.
      // Batch 47 item 1: STRIPE_FAKE=0 in the environment starts the server with no
      // Stripe at all, the state production shows until the Prices exist.
      STRIPE_FAKE: process.env.STRIPE_FAKE ?? "1",
      STRIPE_WEBHOOK_SECRET: "",
      // The job route and the webhook's hand-on need the cron secret the spec also sends.
      CRON_SECRET: e2eCronSecret(),
      // QA live b340ee3, batch C (3) and (4): the log provider's test-only outbox (one JSON line a
      // message, read by e2e/signed-in/reminder-emails.spec.ts) and the pepper the unsubscribe
      // token hangs off (REQ-022 SR-6); neither is set in production this way.
      EMAIL_OUTBOX_FILE: ".e2e-outbox.ndjson",
      HASH_PEPPER:
        process.env.HASH_PEPPER ?? "e2e-hash-pepper-0123456789abcdef", // gitleaks:allow
      // The paid job replays the recorded sole-trader fixtures: never record, never live.
      GENERATION_RECORD: "",
      GENERATION_LIVE: "",
      ANTHROPIC_MODEL: "claude-sonnet-5-5",
      // REQ-022 FR-13 (D-2289): the registered name and ABN reach the server only when the
      // run sets them (CI's identity step; locally by exporting them), so the full run keeps
      // the unset state the spec's other half asserts.
      ...(process.env.BUSINESS_NAME
        ? { BUSINESS_NAME: process.env.BUSINESS_NAME }
        : {}),
      ...(process.env.BUSINESS_ABN
        ? { BUSINESS_ABN: process.env.BUSINESS_ABN }
        : {}),
    },
  },
});
