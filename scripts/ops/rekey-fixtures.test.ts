// @vitest-environment node
/**
 * Re-keys recorded model fixtures after a prompt change that does not change
 * what the model was asked to write (REQ-016 batch 33, D-542): the system
 * prompt carries the house style, and a paragraph about the fixed text we
 * add outside the model's reply and the shape of a blank changed; the
 * replies are still the right answer to the same question. Each fixture's
 * `request.system` and `promptVersion` are rewritten to the current values,
 * its hash recomputed over the current prompt, and the file renamed. The
 * user prompt is never touched: a fixture whose user prompt no longer
 * matches stays orphaned, as D-502 intends. Re-recording at the next model
 * session replaces them all.
 *
 * Runs only when asked, through vitest so the `@/` imports resolve:
 *   REKEY_FIXTURES=1 npx vitest run scripts/ops/rekey-fixtures.test.ts
 * With REKEY_CHECK=1 it only reports what would change and fails if anything would.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PROMPT_VERSION } from "@/lib/generator/context-pack";
import { buildSystemPrompt, canonicalJson } from "@/lib/generator/prompts";

const enabled = process.env.REKEY_FIXTURES === "1";
const check = process.env.REKEY_CHECK === "1";
const DIRS = [
  join("fixtures", "generation"),
  join("fixtures", "generation-claude-haiku-5-5"),
];

function rekeyDir(dir: string): { changed: number; same: number } {
  const system = buildSystemPrompt();
  let changed = 0;
  let same = 0;
  if (!existsSync(dir)) return { changed, same };
  for (const typeId of readdirSync(dir)) {
    const typeDir = join(dir, typeId);
    if (!statSync(typeDir).isDirectory()) continue;
    for (const sectionId of readdirSync(typeDir)) {
      const sectionDir = join(typeDir, sectionId);
      for (const file of readdirSync(sectionDir)) {
        if (!file.endsWith(".json")) continue;
        const path = join(sectionDir, file);
        const fx = JSON.parse(readFileSync(path, "utf8"));
        const hash = createHash("sha256")
          .update(
            canonicalJson({
              promptVersion: PROMPT_VERSION,
              model: fx.model,
              system,
              user: fx.request.user,
            }),
            "utf8",
          )
          .digest("hex");
        if (hash === fx.hash && fx.request.system === system) {
          same += 1;
          continue;
        }
        changed += 1;
        if (check) continue;
        fx.hash = hash;
        fx.promptVersion = PROMPT_VERSION;
        fx.request.system = system;
        fx.rekeyedAt = new Date().toISOString().slice(0, 10);
        const next = join(sectionDir, `${hash}.json`);
        writeFileSync(path, JSON.stringify(fx, null, 2) + "\n", "utf8");
        if (next !== path) {
          if (existsSync(next)) throw new Error(`${next} already exists`);
          renameSync(path, next);
        }
      }
    }
  }
  return { changed, same };
}

describe("re-key recorded fixtures (D-542)", () => {
  it.skipIf(!enabled)(
    "rewrites every fixture's system prompt, version and hash",
    () => {
      for (const dir of DIRS) {
        const r = rekeyDir(dir);
        console.log(
          `${dir}: ${r.changed} fixture(s) ${check ? "need re-keying" : "re-keyed"}, ${r.same} already current`,
        );
        if (check) expect(r.changed).toBe(0);
      }
    },
  );
});
