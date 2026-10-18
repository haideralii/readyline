#!/usr/bin/env node
/**
 * The lawyer's bundle (REQ-022 FR-11, AC-6): one markdown index of everything
 * a lawyer reads, written to product/evidence/req-022/legal-bundle-<date>.md.
 *
 *   node scripts/ops/legal-bundle.mjs [--base https://<domain>] [--date YYYY-MM-DD] [--out <dir>] [--vendor-read YYYY-MM-DD]
 *
 * The index lists, in FR-11's order and each with its URL (or committed path)
 * and "Last updated" date: the five legal pages, the AI and digital tools
 * appendix, the model vendor's commercial terms with the date they were read,
 * the refund promise as /pricing and /documents show it, the pricing page,
 * the sign-in and account-setup screens, the worker invitation and reminder
 * templates, and the committed sole-trader document set; its head lists the
 * FR-12 questions. Built from the committed files alone: no PDF, no browser,
 * no server, no model, no customer data. The pages' dates are their front
 * matter; a code surface's date is the last commit that touched its files.
 *
 * Exits 1 if the output carries a fixture account's address or an unfilled
 * token, so the no-secrets rule is checked where the file is made.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  collect,
  fixtureAddresses,
  indexFileName,
  renderIndex,
  sydneyToday,
} from "./legal-bundle-lib.mjs";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseArgs(argv) {
  const flag = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  // The base is optional while the domain is unregistered (CLAUDE.md 4.1): without it the
  // entries carry the site paths, and the PO rebuilds with the domain on the day.
  const base = flag("--base") ?? argv.find((a) => /^https?:\/\//.test(a));
  const date = flag("--date") ?? sydneyToday();
  const vendorReadOn = flag("--vendor-read") ?? date;
  if (
    (base && !/^https?:\/\//.test(base)) ||
    !DATE.test(date) ||
    !DATE.test(vendorReadOn)
  ) {
    console.error(
      "usage: node scripts/ops/legal-bundle.mjs [--base https://<domain>] [--date YYYY-MM-DD] [--out <dir>] [--vendor-read YYYY-MM-DD]",
    );
    process.exit(2);
  }
  return {
    base: base ? base.replace(/\/$/, "") : null,
    date,
    vendorReadOn,
    out: flag("--out") ?? join("product", "evidence", "req-022"),
  };
}

/** The newest commit date (YYYY-MM-DD) among the paths, from git; "unknown" when git has none. */
function lastChanged(root) {
  return (paths) => {
    const out = execFileSync(
      "git",
      ["log", "-1", "--format=%cs", "--", ...paths],
      { cwd: root, encoding: "utf8" },
    ).trim();
    return out || "unknown";
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  const data = collect(root, { lastChanged: lastChanged(root) });
  const text = renderIndex({
    date: args.date,
    base: args.base,
    vendorReadOn: args.vendorReadOn,
    data,
  });
  const addresses = fixtureAddresses(text);
  if (addresses.length) {
    console.error(
      `FAIL the index would carry ${addresses.length} fixture address(es); nothing written`,
    );
    process.exit(1);
  }
  if (/\{\{|\}\}|\[insert/i.test(text)) {
    console.error(
      "FAIL the index would carry an unfilled token; nothing written",
    );
    process.exit(1);
  }
  const dir = resolve(root, args.out);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, indexFileName(args.date));
  writeFileSync(file, text);
  console.log(
    `ok   wrote ${file} (${data.questions.items.length} questions, ${data.documentSet.files.length} documents)`,
  );
}

main();
