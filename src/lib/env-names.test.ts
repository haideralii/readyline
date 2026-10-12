// @vitest-environment node
/**
 * REQ-010 FR-3: `.env.example` is the single source of variable names. Every
 * variable the application reads from the environment must appear there, so
 * a new setting cannot ship without a line that says where its value comes
 * from. Platform variables Vercel, CI or the runtime set are the only
 * exceptions, listed here.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRODUCTION_REQUIRED, REQUIRED, REQUIRED_LATER } from "./env";

/** Set by the platform, never by Haider. */
const PLATFORM = new Set([
  "NODE_ENV",
  "NEXT_RUNTIME",
  "VERCEL",
  "VERCEL_ENV",
  "VERCEL_REGION",
  "VERCEL_GIT_COMMIT_SHA",
  "CI",
  "GITHUB_ACTIONS",
  "PORT",
]);

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx|mjs)$/.test(name) && !/\.test\.tsx?$/.test(name))
      yield p;
  }
}

function namesReadByCode(): Set<string> {
  const names = new Set<string>();
  const pattern = /\b(?:process\.env|env|source)\.([A-Z][A-Z0-9_]+)\b/g;
  for (const dir of ["src", "scripts"]) {
    for (const file of walk(dir)) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(pattern)) names.add(m[1]);
    }
  }
  // Names read through the name tables rather than a literal property.
  for (const v of [...REQUIRED, ...REQUIRED_LATER]) names.add(v.name);
  return names;
}

function namesInExample(): Set<string> {
  const text = readFileSync(".env.example", "utf8");
  return new Set([...text.matchAll(/^([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]));
}

describe(".env.example names every variable the code reads (REQ-010 FR-3)", () => {
  it("has a line for every environment variable read in src and scripts", () => {
    const example = namesInExample();
    const missing = [...namesReadByCode()]
      .filter((n) => !PLATFORM.has(n) && !example.has(n))
      .sort();
    expect(missing).toEqual([]);
  });

  it("lists every production-required variable", () => {
    const example = namesInExample();
    for (const v of PRODUCTION_REQUIRED)
      expect(example.has(v.name), v.name).toBe(true);
  });

  it("carries no leftover names from earlier designs", () => {
    const example = namesInExample();
    for (const old of [
      "STRIPE_PRICE_DOCUMENT_SET",
      "STRIPE_PRICE_SUBSCRIPTION_MONTHLY",
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    ])
      expect(example.has(old), old).toBe(false);
  });
});
