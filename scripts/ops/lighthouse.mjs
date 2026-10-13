/**
 * Lighthouse accessibility scores for the public pages (REQ-015 FR-19).
 *
 *   node scripts/ops/lighthouse.mjs http://localhost:3100 [out-dir]
 *
 * Runs the Lighthouse CLI (fetched with npx) against each page with the
 * accessibility category only, in Playwright's bundled Chromium when
 * CHROME_PATH is not set, and writes one JSON report per page plus a
 * summary line. Exits non-zero when any page scores under 100.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const outDir = process.argv[3] ?? "product/evidence/req-015/lighthouse";
const pages = ["/", "/start", "/pricing", "/sign-in", "/about", "/refunds"];

function playwrightChrome() {
  const root = join(homedir(), "AppData", "Local", "ms-playwright");
  if (!existsSync(root)) return null;
  const dirs = readdirSync(root)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort()
    .reverse();
  for (const d of dirs)
    for (const sub of ["chrome-win64", "chrome-win"]) {
      const p = join(root, d, sub, "chrome.exe");
      if (existsSync(p)) return p;
    }
  return null;
}

const chrome = process.env.CHROME_PATH ?? playwrightChrome();
if (!chrome) {
  console.error("No Chrome found: set CHROME_PATH");
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });

let failed = false;
for (const path of pages) {
  const name =
    path === "/" ? "home" : path.replace(/^\//, "").replace(/\//g, "-");
  const out = join(outDir, `${name}.json`);
  execFileSync(
    "npx",
    [
      "--yes",
      "lighthouse@12",
      `${base}${path}`,
      "--only-categories=accessibility",
      "--output=json",
      `--output-path=${out}`,
      "--quiet",
      "--chrome-flags=--headless=new --no-sandbox",
    ],
    {
      stdio: "inherit",
      env: { ...process.env, CHROME_PATH: chrome },
      shell: true,
    },
  );
  const report = JSON.parse(readFileSync(out, "utf8"));
  const score = Math.round((report.categories.accessibility.score ?? 0) * 100);
  const failing = Object.values(report.audits)
    .filter(
      (a) =>
        a.score !== null && a.score < 1 && a.scoreDisplayMode !== "informative",
    )
    .map((a) => a.id);
  console.log(
    `${path}: accessibility ${score}${failing.length ? ` (failing: ${failing.join(", ")})` : ""}`,
  );
  if (score < 100) failed = true;
}
process.exit(failed ? 1 : 0);
