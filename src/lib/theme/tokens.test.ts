// @vitest-environment node
/**
 * REQ-014 FR-4 / AC-1: every token pair used for text meets WCAG AA in both
 * themes, and the stylesheet carries exactly the values this module
 * declares (so a change in one place without the other fails here, in CI).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  luminance,
  TEXT_PAIRS,
  TOKEN_NAMES,
  TOKENS,
  WARM_SCALE,
  type ThemeName,
} from "./tokens";

const css = readFileSync("src/app/globals.css", "utf8");

/** The `--name: #hex;` declarations inside the first block whose selector line matches. */
function declarations(selector: RegExp): Record<string, string> {
  const start = css.search(selector);
  if (start < 0) throw new Error(`no block for ${selector}`);
  const open = css.indexOf("{", start);
  let depth = 0;
  let end = open;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const block = css.slice(open, end);
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g))
    out[m[1]] = m[2].toUpperCase();
  return out;
}

describe("identity tokens (REQ-014 FR-4, AC-1)", () => {
  it("computes WCAG luminance and contrast as published", () => {
    expect(luminance("#FFFFFF")).toBeCloseTo(1, 5);
    expect(luminance("#000000")).toBeCloseTo(0, 5);
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 2);
    expect(contrastRatio("#4A5553", "#F7F3EC")).toBeGreaterThan(6.9);
  });

  for (const theme of ["light", "dark"] as ThemeName[]) {
    it(`${theme}: every text pair meets its AA minimum`, () => {
      const failures: string[] = [];
      for (const p of TEXT_PAIRS) {
        const ratio = contrastRatio(TOKENS[theme][p.fg], TOKENS[theme][p.bg]);
        if (ratio < p.min)
          failures.push(
            `${theme} ${p.fg} on ${p.bg} (${p.use}): ${ratio.toFixed(2)} < ${p.min}`,
          );
      }
      expect(failures).toEqual([]);
    });
  }

  it("the stylesheet declares the light tokens on :root and the dark tokens in both dark blocks", () => {
    const root = declarations(/^:root\s*\{/m);
    for (const name of TOKEN_NAMES)
      expect(root[name], `light --${name}`).toBe(TOKENS.light[name]);
    const media = declarations(/:root:not\(\[data-theme="light"\]\)\s*\{/);
    const attr = declarations(/:root\[data-theme="dark"\]\s*\{/);
    for (const name of TOKEN_NAMES) {
      expect(media[name], `dark (media) --${name}`).toBe(TOKENS.dark[name]);
      expect(attr[name], `dark (attribute) --${name}`).toBe(TOKENS.dark[name]);
    }
  });

  it("the warm scale that replaces zinc is monotonic in lightness from paper to ink", () => {
    const steps = Object.keys(WARM_SCALE);
    for (let i = 1; i < steps.length; i++) {
      expect(
        luminance(WARM_SCALE[steps[i]]),
        `${steps[i - 1]} -> ${steps[i]}`,
      ).toBeLessThan(luminance(WARM_SCALE[steps[i - 1]]));
    }
    expect(WARM_SCALE["50"]).toBe(TOKENS.light.paper);
    expect(WARM_SCALE["900"]).toBe(TOKENS.light.ink);
    expect(WARM_SCALE["950"]).toBe(TOKENS.dark.paper);
    // The utilities pages use for secondary and small text keep AA on paper.
    expect(contrastRatio(WARM_SCALE["600"], WARM_SCALE["50"])).toBeGreaterThan(
      4.5,
    );
    expect(contrastRatio(WARM_SCALE["500"], WARM_SCALE["50"])).toBeGreaterThan(
      4.5,
    );
    expect(contrastRatio(WARM_SCALE["400"], WARM_SCALE["950"])).toBeGreaterThan(
      4.5,
    );
    for (const step of steps)
      expect(css.toLowerCase(), `--color-zinc-${step}`).toContain(
        `--color-zinc-${step}: ${WARM_SCALE[step].toLowerCase()}`,
      );
  });
});
