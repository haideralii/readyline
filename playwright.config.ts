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
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
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
      // Backlog 1 (D-1508): the accessibility pass runs on all three projects.
      testMatch:
        /(req-015-width|req-015-accessibility-pass|home-v2|home|req-013-p2|questionnaire|guides|signed-in[\\/](checklist|purchase-flow|registers|guided-path|accessibility-pass|audit-day-registers))\.spec\.ts$/,
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
      STRIPE_FAKE: "1",
      STRIPE_WEBHOOK_SECRET: "",
      // The job route and the webhook's hand-on need the cron secret the spec also sends.
      CRON_SECRET: e2eCronSecret(),
      // The paid job replays the recorded sole-trader fixtures: never record, never live.
      GENERATION_RECORD: "",
      GENERATION_LIVE: "",
      ANTHROPIC_MODEL: "claude-sonnet-5-5",
    },
  },
});
