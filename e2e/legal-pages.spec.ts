import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * REQ-008 on both projects: the footer is on every route (AC-1), the five
 * legal and trust pages render from the markdown with numbered headings and a
 * "Last updated" line (FR-1), they are axe clean and fit a 360 px phone
 * (AC-1), and the home, sign-in and legal pages make no request to any
 * third party and set no third-party cookie (AC-3). With EVIDENCE=1 the
 * request log and full-page screenshots are written to
 * product/evidence/req-008/.
 */
const LEGAL = [
  { path: "/terms", title: "Terms of use" },
  { path: "/privacy", title: "Privacy policy" },
  { path: "/refunds", title: "Refunds" },
  { path: "/ai", title: "How Readyline uses AI" },
  { path: "/about", title: "About Readyline" },
];
const WATCHED = ["/", ...LEGAL.map((p) => p.path), "/sign-in"];
const EVIDENCE_DIR = "product/evidence/req-008";

/** Every route under src/app with its dynamic segments filled with harmless values. */
function appRoutes(): string[] {
  const root = join("src", "app");
  const fill: Record<string, string> = {
    "[setId]": "11111111-1111-4111-8111-111111111111",
    "[typeId]": "incident-management-policy-and-register",
    "[step]": "business",
  };
  const routes = new Set<string>();
  const walk = (dir: string, segments: string[]) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (name.startsWith("(") && name.endsWith(")")) walk(full, segments);
        else
          walk(full, [...segments, fill[name] ?? name.replace(/^\[|\]$/g, "")]);
      } else if (name === "page.tsx") {
        routes.add(`/${segments.join("/")}`);
      }
    }
  };
  walk(root, []);
  return [...routes].sort();
}

/** Hosts a page may talk to: the app itself and the Supabase project (REQ-004); Stripe is added on purchase routes by REQ-007. */
function allowedHost(host: string, appHost: string): boolean {
  if (host === appHost) return true;
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabase && host === new URL(supabase).host) return true;
  return host.endsWith(".supabase.co");
}

async function noSeriousAxeViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(
    serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes)`),
    `${label}: serious or critical axe violations`,
  ).toEqual([]);
}

test.describe("legal and trust pages (REQ-008)", () => {
  test("the footer with its legal links is on every route (AC-1)", async ({
    page,
  }) => {
    const routes = appRoutes();
    // Batch 47 item 9: one visit per route; the budget grows with the route list
    // rather than sharing one 30 s cap across all of them (run 38661716805).
    test.setTimeout(Math.max(60_000, routes.length * 10_000));
    expect(routes).toEqual(expect.arrayContaining(["/", "/terms", "/about"]));
    for (const route of routes) {
      await page.goto(route);
      const nav = page.getByTestId("footer-nav");
      await expect(nav, route).toBeVisible();
      for (const label of [
        "Terms",
        "Privacy",
        "Refunds",
        "How we use AI",
        "About",
      ]) {
        await expect(nav.getByRole("link", { name: label }), route).toHaveCount(
          1,
        );
      }
      await expect(page.getByTestId("site-disclaimer"), route).toContainText(
        /not legal advice/i,
      );
      await expect(page.getByTestId("footer-trust"), route).toContainText(
        "Hosted in Australia",
      );
    }
  });

  test("each page renders its title, the last-updated line, numbered headings and the draft note (FR-1)", async ({
    page,
  }) => {
    for (const { path, title } of LEGAL) {
      await page.goto(path);
      await expect(page, path).toHaveTitle(new RegExp(`^${title} \\|`));
      await expect(
        page.getByRole("heading", { level: 1, name: title }),
        path,
      ).toBeVisible();
      await expect(page.getByTestId("legal-updated"), path).toContainText(
        /^Last updated \d{1,2} [A-Z][a-z]+ \d{4}$/,
      );
      await expect(page.getByTestId("legal-draft-note"), path).toContainText(
        /^Draft\./,
      );
      // QA live b340ee3 (PO): the draft note sits at the foot, under the last heading, in the small type.
      const noteTop =
        (await page.getByTestId("legal-draft-note").boundingBox())?.y ?? 0;
      const lastHeadingTop =
        (await page.getByRole("heading", { level: 2 }).last().boundingBox())
          ?.y ?? Infinity;
      expect(noteTop, path).toBeGreaterThan(lastHeadingTop);
      await expect(page.getByTestId("legal-draft-note"), path).toHaveClass(
        /text-sm/,
      );
      // REQ-028 FR-11: the aside (Jump to and the updated line) from lg, none under it.
      await expect(page.getByRole("complementary"), path).toHaveCount(
        (page.viewportSize()?.width ?? 0) >= 1024 ? 1 : 0,
      );
      const h2s = await page
        .getByRole("heading", { level: 2 })
        .allTextContents();
      expect(h2s.length, path).toBeGreaterThan(2);
      h2s.forEach((text, i) =>
        expect(text, `${path} heading ${i + 1}`).toMatch(
          new RegExp(`^${i + 1} \\S`),
        ),
      );
      expect(
        await page
          .locator("h2, h3")
          .evaluateAll((els) =>
            els.map((el) => el.id).filter((id) => id === ""),
          ),
        `${path}: every heading has an id`,
      ).toEqual([]);
      const overflows = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(overflows, `${path} overflows horizontally`).toBe(false);
      await noSeriousAxeViolations(page, path);
    }
  });

  test("no third-party requests and no third-party cookies on the home, legal and sign-in pages (AC-3)", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const appHost = new URL(baseURL!).host;
    const log: { route: string; url: string; type: string }[] = [];
    let current = "";
    page.on("request", (request) => {
      log.push({
        route: current,
        url: request.url(),
        type: request.resourceType(),
      });
    });
    for (const route of WATCHED) {
      current = route;
      await page.goto(route, { waitUntil: "networkidle" });
      await expect(page.getByTestId("footer-nav")).toBeVisible();
    }
    const offending = log.filter((r) => {
      const url = new URL(r.url);
      if (!/^https?:$/.test(url.protocol)) return false;
      return !allowedHost(url.host, appHost);
    });
    expect(offending, "requests to hosts outside the app").toEqual([]);

    const cookies = await context.cookies();
    const appDomain = appHost.replace(/:\d+$/, "");
    const foreign = cookies.filter(
      (c) => c.domain.replace(/^\./, "") !== appDomain,
    );
    expect(
      foreign.map((c) => `${c.name}@${c.domain}`),
      "third-party cookies",
    ).toEqual([]);

    if (process.env.EVIDENCE) {
      mkdirSync(EVIDENCE_DIR, { recursive: true });
      writeFileSync(
        join(EVIDENCE_DIR, `requests-${testInfo.project.name}.json`),
        JSON.stringify(
          {
            project: testInfo.project.name,
            baseURL,
            recordedAt: new Date().toISOString(),
            hosts: [...new Set(log.map((r) => new URL(r.url).host))],
            cookies: cookies.map((c) => ({ name: c.name, domain: c.domain })),
            requests: log,
          },
          null,
          2,
        ) + "\n",
      );
    }
  });

  test("screenshots of the five pages and the footer (EVIDENCE=1)", async ({
    page,
  }, testInfo) => {
    test.skip(!process.env.EVIDENCE, "set EVIDENCE=1 to capture screenshots");
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    for (const { path } of LEGAL) {
      await page.goto(path);
      await page.screenshot({
        path: `${EVIDENCE_DIR}/${path.slice(1)}-${testInfo.project.name}.jpg`,
        fullPage: true,
        type: "jpeg",
        quality: 40,
        // CSS pixels, not device pixels: the phone profile is 3x and a full page would be megabytes.
        scale: "css",
      });
    }
    await page.goto("/");
    await page.locator("footer").screenshot({
      path: `${EVIDENCE_DIR}/footer-${testInfo.project.name}.jpg`,
      type: "jpeg",
      quality: 50,
      scale: "css",
    });
  });
});
