// @vitest-environment node
/**
 * The kicker workflow (batch 32 item 1, D-1006; schedule and dispatch per
 * D-059), checked without `act` and without a YAML dependency: the file has
 * the shape the runbook describes, every thirty minutes plus the app's
 * `generate` dispatch plus by hand, one run at a time, read-only
 * permissions, the variable and the secret gated and masked, the twenty
 * minute loop inside the job's timeout, and the loop script as the only
 * command.
 */
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const text = readFileSync(".github/workflows/generate-kick.yml", "utf8");
const backup = readFileSync(".github/workflows/backup.yml", "utf8");
const promises = readFileSync(".github/workflows/data-promises.yml", "utf8");
const ci = readFileSync(".github/workflows/ci.yml", "utf8");
const lines = text.split("\n").map((l) => l.replace(/\r$/, ""));

/** Lines that are not comments, with their leading spaces kept. */
const code = lines.filter((l) => l.trim() && !l.trim().startsWith("#"));

describe("generate-kick workflow (batch 32 item 1)", () => {
  it("runs every thirty minutes, on the app's dispatch and by hand, one at a time, read-only", () => {
    expect(code).toContain('    - cron: "*/30 * * * *"');
    expect(code).not.toContain('"*/5 * * * *"');
    expect(code).toContain("  repository_dispatch:");
    expect(code).toContain("    types: [generate]");
    expect(code).toContain("  workflow_dispatch:");
    expect(code).toContain("  group: generate-kick");
    expect(code).toContain("  cancel-in-progress: false");
    const permissions = code.indexOf("permissions:");
    expect(permissions).toBeGreaterThan(-1);
    expect(code[permissions + 1]).toBe("  contents: read");
    expect(text).not.toMatch(/contents:\s*write|pull-requests:\s*write/);
  });

  it("reads PROD_URL from variables and CRON_SECRET from secrets, looping twenty minutes inside the job's timeout and under the schedule", () => {
    expect(code).toContain("      PROD_URL: ${{ vars.PROD_URL }}");
    expect(code).toContain("      CRON_SECRET: ${{ secrets.CRON_SECRET }}");
    const box = Number(text.match(/KICK_MAX_SECONDS: "(\d+)"/)?.[1]);
    expect(box).toBe(1200);
    const timeout = Number(text.match(/timeout-minutes: (\d+)/)?.[1]);
    // One call can run for up to five minutes past the box; the timeout leaves room for it, under the thirty-minute schedule.
    expect(timeout).toBeGreaterThanOrEqual(box / 60 + 5);
    expect(timeout).toBeLessThan(30);
  });

  it("gates on the values, masks the secret, and runs only the loop script", () => {
    expect(text).toContain(
      'if [ -z "$PROD_URL" ] || [ -z "$CRON_SECRET" ]; then',
    );
    expect(text).toContain("::add-mask::$CRON_SECRET");
    // The gate's shell block is `run: |`; every other command is one line: the uptime check
    // (REQ-030 FR-3) and the kick.
    const runs = code.filter((l) => /^\s+run: (?!\|)/.test(l));
    expect(runs).toEqual([
      "        run: node scripts/ops/uptime.mjs",
      "        run: node scripts/ops/kick-generation.mjs",
    ]);
    // The kick is conditional on the gate; the checkout and the uptime steps sit ahead of it.
    const gated = code.filter((l) =>
      l.includes("if: steps.gate.outputs.ready == 'true'"),
    );
    expect(gated).toHaveLength(1);
    expect(text).not.toMatch(/npm (ci|install)/);
    expect(text).toContain(
      "uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1",
    );
  });

  it("REQ-030 FR-3 (D-2867, SR-3): the uptime step runs ahead of the gate on PROD_URL alone, with the issue permission and its cached state", () => {
    const gate = code.indexOf("        id: gate");
    const uptime = code.indexOf("        run: node scripts/ops/uptime.mjs");
    expect(uptime).toBeGreaterThan(-1);
    expect(uptime).toBeLessThan(gate);
    // The permission block: contents read, then issues write for the "Site down" issue, nothing else.
    const permissions = code.indexOf("permissions:");
    expect(code[permissions + 1]).toBe("  contents: read");
    expect(code.slice(permissions, permissions + 4)).toContain(
      "  issues: write",
    );
    expect(text).not.toMatch(/actions:\s*write|contents:\s*write/);
    // The three uptime steps run only with PROD_URL, never needing the cron secret.
    const onProd = code.filter((l) => l === "        if: env.PROD_URL != ''");
    expect(onProd).toHaveLength(3);
    expect(text).toContain(
      "uses: actions/cache/restore@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0",
    );
    expect(text).toContain(
      "uses: actions/cache/save@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0",
    );
    expect(text).toContain("          path: .uptime-state.json");
    expect(text).toContain(
      "          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}",
    );
    // The minutes note names the step's cost.
    expect(text).toContain("the uptime step rides inside");
  });
});

describe("every action is pinned by commit SHA with its version, or keeps its tag with a reason (REQ-012 FR-2, AC-6)", () => {
  const files = readdirSync(".github/workflows").filter((f) =>
    f.endsWith(".yml"),
  );
  const uses: { file: string; line: string }[] = [];
  for (const f of files)
    for (const line of readFileSync(`.github/workflows/${f}`, "utf8").split(
      "\n",
    ))
      if (/^\s*-?\s*uses:/.test(line))
        uses.push({ file: f, line: line.trim() });

  it("finds the uses lines across the workflows", () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
    expect(uses.length).toBeGreaterThanOrEqual(20);
  });

  it("each is owner/name@<40 hex> # vX.Y.Z, or carries '# tag kept:' and a reason", () => {
    for (const { file, line } of uses) {
      const m =
        /^(?:-\s*)?uses:\s*([\w.-]+\/[\w./-]+)@(\S+)(?:\s+#\s*(.*))?$/.exec(
          line,
        );
      expect(m, `${file}: ${line}`).not.toBeNull();
      const [, , ref, comment = ""] = m!;
      const pinned =
        /^[0-9a-f]{40}$/.test(ref) && /^v\d+\.\d+\.\d+/.test(comment);
      const kept = /^tag kept:\s*\S/.test(comment);
      expect(pinned || kept, `${file}: ${line}`).toBe(true);
    }
  });

  it("supabase/setup-cli v3 takes no github-token input and keeps the fixed CLI version (D-038)", () => {
    for (const f of files) {
      const text = readFileSync(`.github/workflows/${f}`, "utf8");
      expect(text, f).not.toContain("github-token: ${{ github.token }}");
      if (text.includes("supabase/setup-cli@"))
        expect(text, f).toMatch(/version: \d+\.\d+\.\d+/);
    }
  });

  it("Dependabot is configured for npm in two groups and for the actions, weekly (D-2902, D-2939)", () => {
    const d = readFileSync(".github/dependabot.yml", "utf8");
    expect(d).toContain("package-ecosystem: npm");
    expect(d).toContain("package-ecosystem: github-actions");
    expect(d).toContain("dependency-type: production");
    expect(d).toContain("dependency-type: development");
    expect((d.match(/interval: weekly/g) ?? []).length).toBe(2);
  });

  it("the e2e job runs the headers check against the production build before the specs (REQ-012 FR-1d, AC-2)", () => {
    const ci = readFileSync(".github/workflows/ci.yml", "utf8");
    const step = ci.indexOf(
      "Security headers on every route class (REQ-012 FR-1d, AC-2)",
    );
    expect(step).toBeGreaterThan(ci.indexOf("- run: npm run build"));
    expect(step).toBeLessThan(ci.indexOf("Install Playwright"));
    expect(ci).toContain(
      "node scripts/ops/check-headers.mjs --base http://localhost:3200 --wait 90",
    );
    expect(ci).toContain("npm run start > /tmp/headers-server.log 2>&1 &");
    expect(ci).toContain("          kill %1");
  });

  it("the e2e job asserts the lockfile and the tree are unchanged after npm ci (FR-2)", () => {
    const ci = readFileSync(".github/workflows/ci.yml", "utf8");
    expect(ci).toContain("git diff --exit-code -- package-lock.json");
    expect(
      ci.indexOf("git diff --exit-code -- package-lock.json"),
    ).toBeLessThan(ci.indexOf("npm audit --omit=dev"));
  });
});

/**
 * REQ-030 FR-2, AC-4 (D-2866, D-2876, SR-2, SR-3): the weekly backup workflow's shape, read
 * from the file: the weekly cron, the two gated and masked secrets, read-only contents, the
 * 90-day artifact, one command, and nothing that could print a value.
 */
describe("backup workflow (REQ-030 FR-2, AC-4)", () => {
  const lines = backup.split("\n").map((l) => l.replace(/\r$/, ""));
  const code = lines.filter((l) => !/^\s*#/.test(l));

  it("runs weekly and by hand, one at a time, read-only, and uploads the encrypted copy for 90 days", () => {
    expect(code).toContain('    - cron: "0 16 * * 6"');
    expect(code).toContain("  workflow_dispatch:");
    expect(code).toContain("  group: backup");
    expect(code).toContain("  cancel-in-progress: false");
    const permissions = code.indexOf("permissions:");
    expect(code[permissions + 1]).toBe("  contents: read");
    expect(backup).not.toMatch(
      /contents:\s*write|issues:\s*write|pull-requests:\s*write/,
    );
    expect(code).toContain("          retention-days: 90");
    expect(code).toContain(
      "        uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2",
    );
  });

  it("gates on both secrets, masks both, builds the URL unprinted, and runs the one script (the direct host as the fallback)", () => {
    expect(backup).toContain(
      'if [ -z "$SUPABASE_DB_PASSWORD" ] || [ -z "$BACKUP_PASSPHRASE" ]; then',
    );
    expect(backup).toContain("::add-mask::$SUPABASE_DB_PASSWORD");
    expect(backup).toContain("::add-mask::$BACKUP_PASSPHRASE");
    expect(backup).toContain("::add-mask::$DB_URL");
    expect(backup).toContain("::add-mask::$DB_URL_DIRECT");
    expect(backup).not.toMatch(/SUPABASE_SECRET_KEY|SUPABASE_ACCESS_TOKEN/);
    const runs = code.filter((l) => /^\s+run: (?!\|)/.test(l));
    expect(runs).toEqual([
      '        run: scripts/ops/backup.sh || DB_URL="$DB_URL_DIRECT" scripts/ops/backup.sh',
    ]);
    const gated = code.filter((l) =>
      l.includes("if: steps.gate.outputs.ready == 'true'"),
    );
    expect(gated.length).toBeGreaterThanOrEqual(5);
    expect(backup).not.toMatch(/echo "\$BACKUP_PASSPHRASE"|echo \$DB_URL/);
  });
});

/** REQ-030 FR-5 (D-2869): the monthly data-promises check's shape. */
describe("data-promises workflow (REQ-030 FR-5)", () => {
  const lines = promises.split("\n").map((l) => l.replace(/\r$/, ""));
  const code = lines.filter((l) => !/^\s*#/.test(l));

  it("runs on the first of the month, read-only, gated and masked, and judges the purge age with the script", () => {
    expect(code).toContain('    - cron: "0 20 1 * *"');
    const permissions = code.indexOf("permissions:");
    expect(code[permissions + 1]).toBe("  contents: read");
    expect(promises).toContain("::add-mask::$SUPABASE_DB_PASSWORD");
    expect(promises).toContain("::add-mask::$DB_URL");
    expect(promises).toContain("node scripts/ops/data-promises.mjs");
    expect(promises).toContain("jobs.purge.ran");
    expect(promises).not.toMatch(/contents:\s*write|issues:\s*write/);
  });
});

/** REQ-030 FR-2, AC-3: CI rehearses the restore on the Supabase job with a fixture passphrase, never the production one. */
describe("the restore rehearsal in CI (REQ-030 AC-3, SR-5)", () => {
  it("dumps with the fixture passphrase, resets the stack, restores, and runs the integration suite again", () => {
    expect(ci).toContain("Backup and restore rehearsal (REQ-030 FR-2, AC-3)");
    // The runner's own client is 16 and the stack is 17 (config.toml): the
    // 17 client is installed before the rehearsal, as backup.yml installs it,
    // or pg_dump stops at once on the version mismatch (#115's first red).
    const client = ci.indexOf("postgresql-client-17");
    expect(client).toBeGreaterThan(-1);
    // ...and first on PATH for the later steps, in both workflows, or the
    // runner's wrapper still runs its own 16 (#115 at 7f37b36).
    for (const text of [
      ci,
      readFileSync(".github/workflows/backup.yml", "utf8"),
    ])
      expect(text).toContain(
        'echo "/usr/lib/postgresql/17/bin" >> "$GITHUB_PATH"',
      );
    expect(client).toBeLessThan(
      ci.indexOf("Backup and restore rehearsal (REQ-030 FR-2, AC-3)"),
    );
    expect(ci).toContain(
      "BACKUP_PASSPHRASE: rehearsal-fixture-passphrase-0123456789",
    );
    // One step per command (the jobs API names the failing one), in order.
    const at = (s: string) => {
      const i = ci.indexOf(s);
      expect(i, s).toBeGreaterThan(-1);
      return i;
    };
    const dump = at("run: scripts/ops/backup.sh");
    const reset = at("run: supabase db reset --local --no-seed");
    const restore = at("run: scripts/ops/restore-rehearsal.sh");
    const suite = at(
      "the integration suite on the restored stack\n        run: npm run test:integration",
    );
    // The counts before the dump and after the restore must match (PO, 18 Oct
    // 18:50): the suite alone would pass on an empty migrated stack.
    const counts = at("the counts after the restore match the counts before");
    expect(ci).toContain('echo "ROWS_BEFORE=$before" >> "$GITHUB_ENV"');
    expect(ci).toContain('test "$after" = "$ROWS_BEFORE"');
    expect(dump).toBeLessThan(reset);
    expect(reset).toBeLessThan(restore);
    expect(restore).toBeLessThan(counts);
    expect(counts).toBeLessThan(suite);
    expect(ci.split("npm run test:integration").length - 1).toBe(2);
    expect(ci).not.toMatch(/secrets\.BACKUP_PASSPHRASE/);
  });
});

/**
 * D-2984 (PO, 19 Oct 2026 05:50): the two long end-to-end steps run as two-shard matrix jobs,
 * one worker each, retries untouched, the artefacts named by shard; the checks job keeps the
 * build and the headers check; the Supabase job keeps the stack, the RLS tests (run once, then
 * again on the restored stack) and the budget, and no longer runs the signed-in specs; the
 * timeouts stay at 20 and 40 on the sharded jobs.
 */
describe("the end-to-end shards (D-2984)", () => {
  const ci = readFileSync(".github/workflows/ci.yml", "utf8");
  const job = (name: string) => {
    const a = ci.indexOf(`\n  ${name}:\n`);
    expect(a, name).toBeGreaterThan(-1);
    const rest = ci.slice(a + 1);
    const b = rest.search(/\n  [a-z0-9_-]+:\n/);
    return b < 0 ? rest : rest.slice(0, b + 1);
  };

  it("the public suite runs as two shards with one worker each, the report named by shard, 20 minutes each", () => {
    const e2e = job("e2e");
    expect(e2e).toContain("shard: [1, 2]");
    expect(e2e).toContain("npm run test:e2e -- --shard=${{ matrix.shard }}/2");
    expect(e2e).toContain("timeout-minutes: 20");
    expect(e2e).toContain("name: playwright-report-shard-${{ matrix.shard }}");
    expect(e2e).toContain("fail-fast: false");
    expect(e2e).not.toMatch(/--workers|retries/);
    // The two small public runs ride one shard each.
    expect(e2e).toContain("e2e/subscription-off.spec.ts");
    expect(e2e).toContain("e2e/business-identity.spec.ts");
    const checks = job("checks");
    expect(checks).not.toContain("npm run test:e2e");
    expect(checks).not.toContain("playwright install");
    expect(checks).toContain("- run: npm run build");
    expect(checks).toContain("Security headers on every route class");
    expect(checks).toContain("timeout-minutes: 20");
  });

  it("the signed-in suite runs as two shards against a stack each shard starts, the screenshots and report named by shard, 40 minutes each", () => {
    const shards = job("signed-in-e2e");
    expect(shards).toContain("shard: [1, 2]");
    expect(shards).toContain(
      "npx playwright test e2e/signed-in --shard=${{ matrix.shard }}/2",
    );
    expect(shards).toContain(
      "supabase start -x studio,imgproxy,logflare,vector",
    );
    expect(shards).toContain("timeout-minutes: 40");
    expect(shards).toContain(
      "name: signed-in-screenshots-shard-${{ matrix.shard }}",
    );
    expect(shards).toContain(
      "name: playwright-report-signed-in-shard-${{ matrix.shard }}",
    );
    expect(shards).toContain("supabase stop --no-backup");
    expect(shards).not.toContain("npm run test:integration");
    const stack = job("supabase-integration");
    expect(stack).not.toContain("e2e/signed-in");
    expect(stack).toContain("npm run perf:budget");
    expect(stack).toContain("timeout-minutes: 40");
    expect(stack.split("npm run test:integration").length - 1).toBe(2);
    expect(stack).toContain("supabase stop --no-backup");
  });
});
