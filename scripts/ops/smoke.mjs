#!/usr/bin/env node
/**
 * Production smoke test (REQ-010 FR-5). Read-only, no sign-in:
 *
 *   npm run smoke -- --base https://<domain>
 *
 * Checks the health route, the home, pricing and sign-in pages, every legal
 * page (200 and the footer's legal links present), and that the CSP header
 * is set. Exits 1 on the first failure, with the URL and what was wrong.
 */
const LEGAL = ["/terms", "/privacy", "/refunds", "/ai", "/about"];

function parseArgs(argv) {
  // `--base <url>`, or a bare URL (some shells swallow the flag when passed through npm).
  const i = argv.indexOf("--base");
  const base = i >= 0 ? argv[i + 1] : argv.find((a) => /^https?:\/\//.test(a));
  if (!base) {
    console.error("usage: npm run smoke -- --base https://<domain>");
    process.exit(2);
  }
  return { base: base.replace(/\/$/, "") };
}

async function get(base, path) {
  const res = await fetch(`${base}${path}`, {
    redirect: "manual",
    headers: { "user-agent": "readyline-smoke/1" },
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, text };
}

function check(condition, label) {
  if (!condition) {
    console.error(`FAIL ${label}`);
    process.exit(1);
  }
  console.log(`ok   ${label}`);
}

async function main() {
  const { base } = parseArgs(process.argv.slice(2));
  console.log(`smoke against ${base}`);

  const health = await get(base, "/api/health");
  check(health.status === 200, "/api/health answers 200");
  const body = JSON.parse(health.text);
  check(
    body.ok === true && typeof body.version === "string",
    "health body has ok and version",
  );
  console.log(
    `     version ${body.version}, region ${body.region}, ${body.deployment}`,
  );

  for (const path of ["/", "/pricing", "/sign-in"]) {
    const r = await get(base, path);
    check(r.status === 200, `${path} answers 200`);
    check(
      Boolean(r.headers.get("content-security-policy")),
      `${path} sends a Content-Security-Policy header`,
    );
  }

  for (const path of LEGAL) {
    const r = await get(base, path);
    check(r.status === 200, `${path} answers 200`);
    for (const link of LEGAL)
      check(
        r.text.includes(`href="${link}"`),
        `${path} footer links to ${link}`,
      );
  }

  const home = await get(base, "/");
  check(
    /not legal advice/i.test(home.text),
    "home carries the general-information statement",
  );
  check(
    !/is being built/.test(home.text),
    "home no longer says it is being built",
  );
  // Batch 26 item 6: the badge renders only off production (D-1309).
  check(
    !/In development/.test(home.text),
    "home does not show the In development badge on production",
  );
  console.log("smoke ok");
}

main().catch((e) => {
  console.error(`FAIL ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
