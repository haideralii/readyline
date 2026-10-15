#!/usr/bin/env node
/**
 * The launch check (REQ-022 FR-2): the subset of /admin/launch that is
 * observable from outside without a session.
 *
 *   node scripts/ops/launch-check.mjs --base https://<domain> [--alias https://<name>.vercel.app]
 *
 * Checks, one line each, exit 1 on the first failure: the health route, the
 * CSP header, every legal page's "Last updated" date within 90 days, the
 * sign-in page's magic-link form, the pack price shown on /pricing, that
 * price against Stripe's unit_amount when STRIPE_SECRET_KEY and
 * STRIPE_PRICE_PACK are in the environment (read-only; nothing is printed
 * but the verdict), and the alias's 301 to the domain when --alias is given.
 * `smoke.mjs` stays the five-second check; this is the launch check.
 */
import {
  daysSinceUpdated,
  parseAudCents,
  redirectsToBase,
  textOfTestId,
} from "./launch-check-lib.mjs";

const LEGAL = ["/terms", "/privacy", "/refunds", "/ai", "/about"];
const FRESH_DAYS = 90;

function parseArgs(argv) {
  const flag = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const base = flag("--base") ?? argv.find((a) => /^https?:\/\//.test(a));
  if (!base) {
    console.error(
      "usage: node scripts/ops/launch-check.mjs --base https://<domain> [--alias https://<name>.vercel.app]",
    );
    process.exit(2);
  }
  const alias = flag("--alias");
  return {
    base: base.replace(/\/$/, ""),
    alias: alias ? alias.replace(/\/$/, "") : null,
  };
}

async function get(url) {
  const res = await fetch(url, {
    redirect: "manual",
    headers: { "user-agent": "readyline-launch-check/1" },
  });
  return { status: res.status, headers: res.headers, text: await res.text() };
}

function ok(label, detail = "") {
  console.log(`ok   ${label}${detail ? ` (${detail})` : ""}`);
}

function fail(label, why) {
  console.error(`FAIL ${label}: ${why}`);
  process.exitCode = 1;
  throw new Error("stop");
}

async function main() {
  const { base, alias } = parseArgs(process.argv.slice(2));

  const health = await get(`${base}/api/health`);
  if (health.status !== 200) fail("health", `status ${health.status}`);
  let body;
  try {
    body = JSON.parse(health.text);
  } catch {
    fail("health", "not JSON");
  }
  if (body.ok !== true) fail("health", "ok is not true");
  ok("health", `${body.deployment}, ${body.region}`);

  const home = await get(`${base}/`);
  if (home.status !== 200) fail("csp", `home status ${home.status}`);
  if (!home.headers.get("content-security-policy"))
    fail("csp", "no Content-Security-Policy header on /");
  ok("csp");

  for (const path of LEGAL) {
    const page = await get(`${base}${path}`);
    if (page.status !== 200) fail(`legal ${path}`, `status ${page.status}`);
    const updated = textOfTestId(page.text, "legal-updated");
    const days = daysSinceUpdated(updated);
    if (days === null) fail(`legal ${path}`, "no readable Last updated line");
    if (days > FRESH_DAYS)
      fail(
        `legal ${path}`,
        `Last updated is ${Math.floor(days)} days old (limit ${FRESH_DAYS})`,
      );
    ok(`legal ${path}`, `${Math.floor(days)} days`);
  }

  const signIn = await get(`${base}/sign-in`);
  if (signIn.status !== 200) fail("sign-in form", `status ${signIn.status}`);
  if (!/<form/.test(signIn.text) || !/name="email"/.test(signIn.text))
    fail("sign-in form", "no form with an email field");
  ok("sign-in form");

  const pricing = await get(`${base}/pricing`);
  if (pricing.status !== 200)
    fail("pricing shows the pack price", `status ${pricing.status}`);
  const shown = parseAudCents(textOfTestId(pricing.text, "pack-price"));
  if (shown === null)
    fail(
      "pricing shows the pack price",
      "no AUD amount in the pack-price element",
    );
  ok("pricing shows the pack price", `AUD ${shown / 100}`);

  const key = process.env.STRIPE_SECRET_KEY?.trim();
  const priceId = process.env.STRIPE_PRICE_PACK?.trim();
  if (key && priceId) {
    const res = await fetch(
      `https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`,
      {
        headers: { authorization: `Bearer ${key}` },
      },
    );
    if (res.status !== 200)
      fail(
        "pack price equals Stripe's unit_amount",
        `Stripe answered ${res.status}`,
      );
    const price = await res.json();
    if (price.currency !== "aud")
      fail("pack price equals Stripe's unit_amount", "the Price is not in AUD");
    if (price.unit_amount !== shown)
      fail(
        "pack price equals Stripe's unit_amount",
        "the amount on /pricing differs from the Price",
      );
    ok(
      "pack price equals Stripe's unit_amount",
      price.livemode ? "live Price" : "test Price",
    );
  } else {
    console.log(
      "skip pack price equals Stripe's unit_amount (no STRIPE_SECRET_KEY and STRIPE_PRICE_PACK in the environment)",
    );
  }

  if (alias) {
    for (const path of ["/", "/pricing", "/sign-in"]) {
      const r = await get(`${alias}${path}`);
      if (!redirectsToBase(r.status, r.headers.get("location"), base, path))
        fail(
          "alias redirects to the domain",
          `${path} answered ${r.status} without a 301 to the domain`,
        );
    }
    ok("alias redirects to the domain");
  } else {
    console.log("skip alias redirects to the domain (no --alias)");
  }
}

main().catch((e) => {
  if (!(e instanceof Error && e.message === "stop")) {
    console.error(`FAIL ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  }
});
