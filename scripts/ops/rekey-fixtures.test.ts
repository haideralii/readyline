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
import {
  documentTypeById,
  reviewCyclesFor,
  sectionsFor,
  type SectionSpec,
} from "@/lib/generator/catalogue";
import {
  PROMPT_VERSION,
  briefFor,
  buildContextPack,
} from "@/lib/generator/context-pack";
import { standardsForType } from "@/lib/generator/document-model";
import {
  buildModelRequest,
  buildSystemPrompt,
  canonicalJson,
  requestHash,
} from "@/lib/generator/prompts";
import { loadReferenceCases } from "@/lib/generator/reference-cases";
import { getStandardsDataset } from "@/lib/standards/dataset";

const enabled = process.env.REKEY_FIXTURES === "1";
const check = process.env.REKEY_CHECK === "1";
/**
 * Batch 35 (D-1802): a brief or a prompt block changed for named sections
 * only. Their recorded replies answer the question as it was; re-keying
 * them under the current user prompt keeps the replay and the committed
 * sample honest about what was recorded (the fixture says so in
 * `userRekeyNote`) until the next recording session re-records them.
 *   REKEY_USER=1 REKEY_SECTIONS="typeId/sectionId,..." REKEY_NOTE="..." npx vitest run scripts/ops/rekey-fixtures.test.ts
 * Each fixture is matched to its reference case by the trading name in its
 * old FACTS block, so the new prompt is the real one for that case.
 */
const userMode = process.env.REKEY_USER === "1";
const userSections = (process.env.REKEY_SECTIONS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const userNote = process.env.REKEY_NOTE ?? "";

/**
 * The catalogue as it was before the change (`git show <sha>:data/readyline-content/document-types.json`
 * saved to a file), so the previous brief of each section is known exactly
 * and only the live recording under it moves; a recording of an older brief
 * stays as history, as D-502 intends.
 */
const previousCataloguePath = process.env.REKEY_PREVIOUS_CATALOGUE ?? "";
type PreviousCatalogue = {
  outlines: Record<string, SectionSpec[]>;
  items: { id: string; outline: string; extraSections: SectionSpec[] }[];
};
function previousSection(
  typeId: string,
  sectionId: string,
): SectionSpec | undefined {
  if (!previousCataloguePath) return undefined;
  const prev = JSON.parse(
    readFileSync(previousCataloguePath, "utf8"),
  ) as PreviousCatalogue;
  const item = prev.items.find((i) => i.id === typeId);
  if (!item) return undefined;
  return (
    item.extraSections.find((s) => s.id === sectionId) ??
    prev.outlines[item.outline]?.find((s) => s.id === sectionId)
  );
}

function rekeyUserPrompts(dir: string): {
  changed: number;
  same: number;
  unmatched: string[];
} {
  const dataset = getStandardsDataset();
  const cases = loadReferenceCases();
  let changed = 0;
  let same = 0;
  const unmatched: string[] = [];
  for (const key of userSections) {
    const [typeId, sectionId] = key.split("/");
    const sectionDir = join(dir, typeId, sectionId);
    if (!existsSync(sectionDir)) continue;
    const type = documentTypeById(typeId);
    const section = type
      ? sectionsFor(type).find((s) => s.id === sectionId)
      : undefined;
    if (!type || !section) throw new Error(`unknown section ${key}`);
    for (const file of readdirSync(sectionDir)) {
      if (!file.endsWith(".json")) continue;
      const path = join(sectionDir, file);
      const fx = JSON.parse(readFileSync(path, "utf8"));
      const tradingName = /^tradingName: (.+)$/m.exec(fx.request.user)?.[1];
      const c = cases.find(
        (x) => x.answers.business.tradingName === tradingName,
      );
      if (!c) {
        unmatched.push(`${key}/${file}`);
        continue;
      }
      const built = buildModelRequest(
        buildContextPack({
          answers: c.answers,
          result: c.result,
          dataset,
          type,
          section,
        }),
        fx.model,
        fx.request.maxTokens,
      );
      // A retry's prompt is the first attempt's plus the rejection (generate-section.ts); keep that suffix.
      const marker = "\n\nYour previous reply was rejected";
      const at = (fx.request.user as string).indexOf(marker);
      const oldPrefix =
        at === -1 ? fx.request.user : fx.request.user.slice(0, at);
      const suffix = at === -1 ? "" : fx.request.user.slice(at);
      // Only a live recording moves: its old first-attempt prompt must equal the
      // new one with this batch's changes undone (the STATE FACTS paragraphs
      // removed and the previous catalogue's brief for this section put back,
      // through the same briefFor rules, with this document's additions off).
      // An orphaned recording of an earlier brief stays as history (D-502).
      const prev = previousSection(typeId, sectionId);
      if (!prev)
        throw new Error(
          `no previous brief for ${key}; set REKEY_PREVIOUS_CATALOGUE`,
        );
      const previousBrief = briefFor(
        prev,
        { ...type, briefAdditions: undefined },
        standardsForType(type, dataset, c.result).length,
        reviewCyclesFor(type),
      );
      const undone = built.user
        .replace(
          /\n\n<<<STATE FACTS>>>[\s\S]*?<<<END STATE FACTS>>>\n\nEverything between <<<STATE FACTS>>>[^\n]*/,
          "",
        )
        .replace(/^Section brief: .*$/m, `Section brief: ${previousBrief}`);
      if (undone !== oldPrefix) {
        unmatched.push(`${key}/${file} (an earlier brief; left as history)`);
        continue;
      }
      const request = { ...built, user: `${built.user}${suffix}` };
      const hash = requestHash(request);
      // vitest runs silent here; the debug trail goes to a file the operator names.
      if (process.env.REKEY_DEBUG)
        writeFileSync(
          process.env.REKEY_DEBUG,
          `${key}/${file.slice(0, 8)}: model=${fx.model} max=${fx.request.maxTokens} suffix=${suffix ? "retry" : "first"} old=${String(fx.hash).slice(0, 8)} new=${hash.slice(0, 8)} ${hash === fx.hash ? "same" : "changed"}\n`,
          { flag: "a" },
        );
      if (hash === fx.hash) {
        same += 1;
        continue;
      }
      changed += 1;
      if (check) continue;
      fx.hash = hash;
      fx.promptVersion = PROMPT_VERSION;
      fx.request.system = request.system;
      fx.request.user = request.user;
      fx.rekeyedAt = new Date().toISOString().slice(0, 10);
      fx.userRekeyedAt = fx.rekeyedAt;
      fx.userRekeyNote = userNote;
      const next = join(sectionDir, `${hash}.json`);
      writeFileSync(path, JSON.stringify(fx, null, 2) + "\n", "utf8");
      if (next !== path) {
        if (existsSync(next)) throw new Error(`${next} already exists`);
        renameSync(path, next);
      }
    }
  }
  return { changed, same, unmatched };
}
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

  it.skipIf(!userMode)(
    "re-keys the named sections under the current user prompt, matched to their reference case (D-1802)",
    () => {
      expect(userSections.length, "REKEY_SECTIONS is empty").toBeGreaterThan(0);
      if (!check)
        expect(userNote.length, "REKEY_NOTE is empty").toBeGreaterThan(10);
      for (const dir of DIRS) {
        const r = rekeyUserPrompts(dir);
        console.log(
          `${dir}: ${r.changed} fixture(s) ${check ? "need a user re-key" : "re-keyed under the current user prompt"}, ${r.same} already current${r.unmatched.length ? `, unmatched: ${r.unmatched.join(", ")}` : ""}`,
        );
        // A recording of an earlier brief stays as history; a fixture whose case cannot be found is an error.
        expect(
          r.unmatched.filter((u) => !u.includes("left as history")),
        ).toEqual([]);
      }
    },
  );
});
