// @vitest-environment node
/**
 * Performance budgets with Lighthouse in the mobile profile (REQ-010,
 * standing backlog 2, D-1012): the home, pricing, questionnaire and
 * documents pages must score 90 or more for performance, paint their
 * largest content within 2.5 s and shift by at most 0.1, and the
 * questionnaire must ship under 250 kB of JavaScript. Lighthouse's default
 * run is the mobile profile (an emulated mid-range phone on simulated 4G),
 * so no extra flags are needed for it.
 *
 * Runs only when asked, through vitest so the `@/` and e2e helpers resolve:
 *   LIGHTHOUSE_BUDGET=1 npx vitest run scripts/ops/lighthouse-budget.test.ts
 * Needs `npm run build` first; it starts `next start` on port 3100 itself
 * unless LIGHTHOUSE_BASE_URL points at a running server. Chrome is
 * Playwright's Chromium unless CHROME_PATH is set; a failed Lighthouse run
 * fails the test with the command and Lighthouse's stderr (batch 45a,
 * D-1013). Options:
 *   LIGHTHOUSE_PAGES="/,/pricing"   the pages (default: all five)
 *   LIGHTHOUSE_RUNS=3               runs per page; the median counts (default 1)
 *   LIGHTHOUSE_EVIDENCE=1           also write product/evidence/req-010/lighthouse/summary.md
 * The documents page needs a signed-in account; with the Supabase variables
 * present a throwaway tenant is created and its session sent as a cookie,
 * without them the page is skipped and the report says so. The report is
 * always written to out/lighthouse-budget.txt because vitest shows no
 * console output.
 */
import { chromium } from "@playwright/test";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  e2eCronSecret,
  hasSupabaseForE2e,
  loadLocalEnv,
} from "../../e2e/helpers/env";
import {
  createTenant,
  deleteTenant,
  type TestTenant,
} from "../../e2e/helpers/session";

const enabled = process.env.LIGHTHOUSE_BUDGET === "1";
const LIGHTHOUSE_VERSION = "12.8.2";
const PORT = 3100;

/** The budgets, mobile profile. JS is the transfer size of every script the page loads. */
export const BUDGETS = {
  performance: 90,
  lcpMs: 2500,
  cls: 0.1,
  questionnaireJsBytes: 250_000,
} as const;

const ALL_PAGES = ["/", "/pricing", "/start", "/start/business", "/documents"];
const QUESTIONNAIRE_PAGES = new Set(["/start", "/start/business"]);
const SIGNED_IN_PAGES = new Set(["/documents"]);

export type PageResult = {
  path: string;
  runs: number;
  performance: number;
  lcpMs: number;
  cls: number;
  jsBytes: number;
  /** The audits Lighthouse flags for the page, for the report. */
  opportunities: string[];
};

function pagesWanted(): string[] {
  const raw = process.env.LIGHTHOUSE_PAGES?.trim();
  return raw
    ? raw
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
    : ALL_PAGES;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

async function waitForHealth(base: string, ms: number) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${base}/api/health`);
      if (r.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${base}/api/health did not answer within ${ms} ms`);
}

/** Starts `next start` with the same variables the e2e server gets, on its own port. */
function startServer(): { child: ChildProcess; base: string } {
  const base = `http://localhost:${PORT}`;
  const child = spawn("npx", ["next", "start", "-p", String(PORT)], {
    shell: true,
    stdio: "ignore",
    env: {
      ...process.env,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? base,
      PACK_PRICE_AUD_CENTS: process.env.PACK_PRICE_AUD_CENTS ?? "39900",
      GST_LINE:
        process.env.GST_LINE ??
        "No GST while Readyline is not registered for GST.",
      SUBSCRIPTION_PRICE_AUD_CENTS:
        process.env.SUBSCRIPTION_PRICE_AUD_CENTS ?? "3900",
      STRIPE_FAKE: "1",
      STRIPE_WEBHOOK_SECRET: "",
      CRON_SECRET: e2eCronSecret(),
      GENERATION_RECORD: "",
      GENERATION_LIVE: "",
      ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5",
    },
  });
  return { child, base };
}

function stopServer(child: ChildProcess) {
  if (child.pid === undefined) return;
  if (process.platform === "win32")
    try {
      execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });
    } catch {
      // already gone
    }
  else child.kill("SIGTERM");
}

/** The session cookie header `@supabase/ssr` reads, as e2e/helpers/session.ts writes it. */
function cookieHeader(tenant: TestTenant): string {
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(
    ".",
  )[0];
  const name = `sb-${ref}-auth-token`;
  const encoded =
    "base64-" +
    Buffer.from(JSON.stringify(tenant.session), "utf8").toString("base64url");
  const MAX = 3180;
  if (encodeURIComponent(encoded).length <= MAX) return `${name}=${encoded}`;
  const parts: string[] = [];
  for (let i = 0, n = 0; i < encoded.length; i += MAX, n++)
    parts.push(`${name}.${n}=${encoded.slice(i, i + MAX)}`);
  return parts.join("; ");
}

type Audit = {
  id: string;
  score: number | null;
  numericValue?: number;
  scoreDisplayMode?: string;
  details?: { items?: { resourceType?: string; transferSize?: number }[] };
};

function runLighthouse(
  url: string,
  outPath: string,
  chrome: string,
  cookie: string | null,
) {
  // Batch 45a (D-1013): on a runner the flags must reach Chrome as one
  // argument, quoted, and the call runs with its output captured so a
  // failure prints Lighthouse's own words, never a null. `--quiet` is kept
  // off CI only; on a laptop the progress lines are noise.
  const chromeFlags =
    "--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage";
  const args = [
    "--yes",
    `lighthouse@${LIGHTHOUSE_VERSION}`,
    url,
    "--only-categories=performance",
    "--output=json",
    `--output-path=${outPath}`,
    ...(process.env.CI ? [] : ["--quiet"]),
    // Applied throttling, not simulated (D-1012): against a local server the
    // HTML arrives before the first frame, so the observed first paint waits
    // for the scripts to run and the simulation then ties the largest paint
    // to the JavaScript; with the mobile profile applied for real the HTML
    // paints before the scripts arrive, as on a phone.
    "--throttling-method=devtools",
    `--chrome-flags="${chromeFlags}"`,
  ];
  if (cookie) {
    // A JSON argument does not survive the Windows shell; Lighthouse also takes a file path.
    const headersPath = join("out", "lighthouse", "headers.json");
    writeFileSync(headersPath, JSON.stringify({ Cookie: cookie }));
    args.push(`--extra-headers=${headersPath}`);
  }
  try {
    execFileSync("npx", args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, CHROME_PATH: chrome },
      shell: true,
      timeout: 240_000,
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (e) {
    const err = e as { status?: number; stderr?: Buffer; stdout?: Buffer };
    const tail = (b?: Buffer) =>
      (b ? b.toString("utf8") : "").trim().split("\n").slice(-40).join("\n");
    throw new Error(
      [
        `Lighthouse exited with ${err.status ?? "a signal"} for ${url} (Chrome: ${chrome}).`,
        `Command: npx ${args.join(" ")}`,
        tail(err.stderr) ? `stderr:\n${tail(err.stderr)}` : "stderr: (empty)",
        tail(err.stdout) ? `stdout:\n${tail(err.stdout)}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  const report = JSON.parse(readFileSync(outPath, "utf8")) as {
    categories: { performance: { score: number | null } };
    audits: Record<string, Audit>;
  };
  const audits = report.audits;
  const scripts = (audits["resource-summary"]?.details?.items ?? []).filter(
    (i) => i.resourceType === "script",
  );
  return {
    performance: Math.round((report.categories.performance.score ?? 0) * 100),
    lcpMs: Math.round(audits["largest-contentful-paint"]?.numericValue ?? 0),
    cls: Number(
      (audits["cumulative-layout-shift"]?.numericValue ?? 0).toFixed(3),
    ),
    jsBytes: scripts.reduce((n, i) => n + (i.transferSize ?? 0), 0),
    opportunities: Object.values(audits)
      .filter(
        (a) =>
          a.score !== null &&
          a.score < 0.9 &&
          a.scoreDisplayMode !== "informative" &&
          a.scoreDisplayMode !== "notApplicable",
      )
      .map((a) => a.id),
  };
}

function kb(bytes: number) {
  return `${Math.round(bytes / 100) / 10} kB`;
}

function formatReport(results: PageResult[], notes: string[], base: string) {
  const lines = [
    `# Performance budgets (REQ-010, backlog 2)`,
    "",
    `Lighthouse ${LIGHTHOUSE_VERSION}, mobile profile (emulated phone, 4G and a 4x slower CPU applied for real), performance category, against ${base}, one warm-up request per page; the median of each page's runs counts. Budgets: performance ${BUDGETS.performance}+, LCP ${BUDGETS.lcpMs} ms, CLS ${BUDGETS.cls}, JavaScript on the questionnaire under ${kb(BUDGETS.questionnaireJsBytes)}.`,
    "",
    "| Page | Runs | Performance | LCP | CLS | JavaScript | Flagged audits |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...results.map(
      (r) =>
        `| ${r.path} | ${r.runs} | ${r.performance} | ${r.lcpMs} ms | ${r.cls} | ${kb(r.jsBytes)} | ${r.opportunities.join(", ") || "none"} |`,
    ),
    "",
    ...notes.map((n) => `- ${n}`),
    "",
  ];
  return lines.join("\n");
}

describe.skipIf(!enabled)("performance budgets (REQ-010, backlog 2)", () => {
  let child: ChildProcess | null = null;
  let base = process.env.LIGHTHOUSE_BASE_URL?.replace(/\/$/, "") ?? "";
  let tenant: TestTenant | null = null;
  const results: PageResult[] = [];
  const notes: string[] = [];

  beforeAll(async () => {
    loadLocalEnv();
    if (!base) {
      if (!existsSync(join(".next", "BUILD_ID")))
        throw new Error("No production build: run `npm run build` first");
      const started = startServer();
      child = started.child;
      base = started.base;
    }
    await waitForHealth(base, 60_000);
    if (pagesWanted().some((p) => SIGNED_IN_PAGES.has(p))) {
      if (hasSupabaseForE2e()) {
        const answers = JSON.parse(
          readFileSync(
            "fixtures/reference-cases/verification-sole-trader.json",
            "utf8",
          ),
        ) as Record<string, unknown>;
        tenant = await createTenant({
          label: "lighthouse",
          tradingName: "Sunrise Supports",
          answers,
        });
      } else
        notes.push(
          "/documents skipped: no Supabase variables, so no signed-in session.",
        );
    }
  }, 120_000);

  afterAll(async () => {
    if (tenant) await deleteTenant(tenant);
    if (child) stopServer(child);
    mkdirSync("out", { recursive: true });
    const report = formatReport(results, notes, base);
    writeFileSync("out/lighthouse-budget.txt", report);
    if (process.env.LIGHTHOUSE_EVIDENCE === "1") {
      const dir = join("product", "evidence", "req-010", "lighthouse");
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, "summary.md"),
        report.replace(
          "# Performance budgets (REQ-010, backlog 2)",
          `# Performance budgets (REQ-010, backlog 2)\n\nRun ${new Date().toISOString().slice(0, 10)} with scripts/ops/lighthouse-budget.test.ts against a local production build.`,
        ),
      );
    }
  });

  it("every page meets the budgets (median of the runs)", async () => {
    const chrome = process.env.CHROME_PATH ?? chromium.executablePath();
    expect(existsSync(chrome), `Chrome at ${chrome}`).toBe(true);
    const runs = Math.max(1, Number(process.env.LIGHTHOUSE_RUNS ?? "1") || 1);
    mkdirSync(join("out", "lighthouse"), { recursive: true });
    const failures: string[] = [];
    for (const path of pagesWanted()) {
      const signedIn = SIGNED_IN_PAGES.has(path);
      if (signedIn && !tenant) continue;
      const cookie = signedIn && tenant ? cookieHeader(tenant) : null;
      const name =
        path === "/" ? "home" : path.replace(/^\//, "").replace(/\//g, "-");
      // One plain request first: the first render of a route warms the
      // server's caches (the standards dataset, the content tables), and a
      // phone's score should not carry that one-off.
      await fetch(`${base}${path}`, {
        headers: cookie ? { Cookie: cookie } : {},
        redirect: "manual",
      }).catch(() => undefined);
      const samples = [];
      for (let i = 0; i < runs; i += 1)
        samples.push(
          runLighthouse(
            `${base}${path}`,
            join("out", "lighthouse", `${name}-${i + 1}.json`),
            chrome,
            cookie,
          ),
        );
      const r: PageResult = {
        path,
        runs,
        performance: median(samples.map((s) => s.performance)),
        lcpMs: median(samples.map((s) => s.lcpMs)),
        cls: median(samples.map((s) => s.cls)),
        jsBytes: median(samples.map((s) => s.jsBytes)),
        opportunities: [...new Set(samples.flatMap((s) => s.opportunities))],
      };
      results.push(r);
      if (r.performance < BUDGETS.performance)
        failures.push(
          `${path}: performance ${r.performance} is under ${BUDGETS.performance} (flagged: ${r.opportunities.join(", ") || "none"})`,
        );
      if (r.lcpMs > BUDGETS.lcpMs)
        failures.push(`${path}: LCP ${r.lcpMs} ms is over ${BUDGETS.lcpMs} ms`);
      if (r.cls > BUDGETS.cls)
        failures.push(`${path}: CLS ${r.cls} is over ${BUDGETS.cls}`);
      if (
        QUESTIONNAIRE_PAGES.has(path) &&
        r.jsBytes >= BUDGETS.questionnaireJsBytes
      )
        failures.push(
          `${path}: JavaScript ${kb(r.jsBytes)} is not under ${kb(BUDGETS.questionnaireJsBytes)}`,
        );
    }
    expect(results.length).toBeGreaterThan(0);
    expect(failures, "budget failures").toEqual([]);
  }, 1_800_000);
});

describe.skipIf(enabled)("performance budgets (skipped)", () => {
  it("runs only with LIGHTHOUSE_BUDGET=1", () => {
    expect(enabled).toBe(false);
  });
});
