// @vitest-environment node
/**
 * The Vercel ignored-build rule (batch 46, D-2206) against real commits in a
 * throwaway repository: a docs-only commit on main skips, a code change on
 * main builds, anything off main skips, and a root commit builds. Runs
 * wherever `bash` and `git` are on the path (CI's runner; Git for Windows
 * locally); skips otherwise.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

// Each case spawns several git processes; under the full suite's load that
// passes vitest's 5 s default on a laptop.
vi.setConfig({ testTimeout: 60_000 });

const SCRIPT = resolve("scripts/ops/vercel-ignore-build.sh");
// On a Windows laptop `bash` on the path can be WSL's launcher with no
// distribution; Git for Windows carries a real one.
const BASH =
  ["bash", "C:\\Program Files\\Git\\bin\\bash.exe"].find((b) => {
    const r = spawnSync(b, ["--version"], { encoding: "utf8" });
    return r.status === 0 && /GNU bash/.test(r.stdout ?? "");
  }) ?? null;

function run(cwd: string, args: string[], env: Record<string, string> = {}) {
  const r = spawnSync("git", args, {
    cwd,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "t",
      GIT_AUTHOR_EMAIL: "t@example.test",
      GIT_COMMITTER_NAME: "t",
      GIT_COMMITTER_EMAIL: "t@example.test",
      ...env,
    },
  });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
}

function commit(cwd: string, file: string, text: string, message: string) {
  mkdirSync(join(cwd, file, ".."), { recursive: true });
  writeFileSync(join(cwd, file), text);
  run(cwd, ["add", "-A"]);
  run(cwd, ["-c", "commit.gpgsign=false", "commit", "-q", "-m", message]);
}

function decide(cwd: string, ref: string): { code: number; out: string } {
  const r = spawnSync(BASH ?? "bash", [SCRIPT], {
    cwd,
    env: { ...process.env, VERCEL_GIT_COMMIT_REF: ref },
    encoding: "utf8",
  });
  return { code: r.status ?? -1, out: `${r.stdout}${r.stderr}`.trim() };
}

describe.skipIf(!BASH)("vercel-ignore-build.sh (D-2206)", () => {
  const repo = mkdtempSync(join(tmpdir(), "readyline-ignore-build-"));
  run(repo, ["init", "-q", "-b", "main"]);

  it("a root commit builds (nothing to compare with)", () => {
    commit(repo, "src/a.ts", "export const a = 1;\n", "root");
    const r = decide(repo, "main");
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/^build: no parent/);
  });

  it("a docs-only commit on main skips: product/ and markdown anywhere", () => {
    commit(repo, "product/NEXT.md", "status\n", "status");
    expect(decide(repo, "main").code).toBe(0);
    commit(repo, "DECISIONS.md", "D-1\n", "decision");
    expect(decide(repo, "main").code).toBe(0);
    commit(repo, "docs/deep/notes.md", "notes\n", "deep markdown");
    const r = decide(repo, "main");
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/^skip: only product/);
  });

  it("a code change on main builds, even beside a markdown change", () => {
    commit(repo, "src/a.ts", "export const a = 2;\n", "code");
    expect(decide(repo, "main").code).toBe(1);
    writeFileSync(join(repo, "README.md"), "readme\n");
    commit(repo, "src/b.ts", "export const b = 1;\n", "code and docs");
    const r = decide(repo, "main");
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/^build: code changed/);
  });

  it("any ref other than main skips, whatever changed", () => {
    commit(repo, "src/c.ts", "export const c = 1;\n", "code on a branch");
    const r = decide(repo, "next");
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/not main/);
    expect(decide(repo, "").code).toBe(0);
  });
});
