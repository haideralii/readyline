#!/usr/bin/env node
/**
 * REQ-004 AC-8: the Supabase secret key must never reach the browser. After
 * `next build`, scan every file under .next/static for the secret variable
 * name, the secret-key prefix, and the value itself when it is set in the
 * environment. Exits 1 with the offending file on any hit.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), ".next", "static");
const needles = ["SUPABASE_SECRET_KEY", "sb_secret_"];
const secret = process.env.SUPABASE_SECRET_KEY?.trim();
if (secret && secret.length >= 16) needles.push(secret);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

let files = 0;
const hits = [];
try {
  for (const file of walk(root)) {
    files++;
    const text = readFileSync(file, "utf8");
    for (const needle of needles) {
      if (text.includes(needle))
        hits.push({
          file,
          needle: needle === secret ? "<secret value>" : needle,
        });
    }
  }
} catch (e) {
  console.error(
    `check-client-bundle: cannot read ${root}: ${e.message}. Run \`next build\` first.`,
  );
  process.exit(2);
}

if (hits.length) {
  for (const h of hits)
    console.error(`check-client-bundle: ${h.needle} found in ${h.file}`);
  process.exit(1);
}
console.log(
  `check-client-bundle: ${files} client files scanned, no Supabase secret material found.`,
);
