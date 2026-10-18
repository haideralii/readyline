// REQ-032 FR-1 (D-2915): prints the `insert` rows for public.public_holidays from
// data/public-holidays/<year>.json, so the migration's seed is the fixture's rows and the
// two cannot drift (public-holidays-seed.test.ts compares the migration with this output).
//
//   node scripts/holidays/seed.mjs            # the SQL to stdout
//   node scripts/holidays/seed.mjs --years    # the years found, one per line
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "data/public-holidays";
const JURISDICTIONS = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "ACT", "NT"];

export function holidayFiles() {
  return readdirSync(DIR)
    .filter((f) => /^\d{4}\.json$/.test(f))
    .sort();
}

export function seedRows() {
  const rows = [];
  for (const file of holidayFiles()) {
    const parsed = JSON.parse(readFileSync(join(DIR, file), "utf8"));
    for (const h of parsed.holidays) {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(h.date) ||
        !JURISDICTIONS.includes(h.jurisdiction)
      )
        throw new Error(`${file}: bad row ${JSON.stringify(h)}`);
      rows.push({ date: h.date, jurisdiction: h.jurisdiction, name: h.name });
    }
  }
  rows.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      JURISDICTIONS.indexOf(a.jurisdiction) -
        JURISDICTIONS.indexOf(b.jurisdiction),
  );
  return rows;
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

export function seedSql() {
  const rows = seedRows();
  const values = rows.map(
    (r) => `  (${q(r.date)}, ${q(r.jurisdiction)}, ${q(r.name)})`,
  );
  return (
    `insert into public.public_holidays (holiday_date, jurisdiction, name) values\n` +
    values.join(",\n") +
    `\non conflict (holiday_date, jurisdiction) do update set name = excluded.name;\n`
  );
}

if (process.argv[1] && /seed\.mjs$/.test(process.argv[1])) {
  if (process.argv.includes("--years"))
    for (const f of holidayFiles()) console.log(f.replace(".json", ""));
  else process.stdout.write(seedSql());
}
