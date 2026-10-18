/**
 * REQ-012 FR-4d (AC-11; D-2910, D-2906): the read cadence per source kind
 * and the flag for a source past it. The cadence replaces the flat 90 days:
 * Commission reform and apply pages 30 days; Practice Standards module
 * pages and PDFs 90 days; legislation.gov.au compilations on each
 * watch-changes run (no age flag here, the ledger is the proof); third-party
 * prices 30 days; the vendors' terms and the legal pages' `updated` dates
 * join the table with their own kinds. Dates are ISO days; `today` is
 * passed in, so the unit test fixes it.
 */

export const CADENCE_DAYS = Object.freeze({
  "commission-reform": 30,
  "commission-apply": 30,
  "practice-standards": 90,
  legislation: null, // each watch-changes run and every REQ-023 batch
  "third-party-price": 30,
  "vendor-terms": 90,
  "legal-page": 90,
  "commission-page": 90,
});

export function cadenceDays(kind) {
  if (!(kind in CADENCE_DAYS)) throw new Error(`unknown source kind: ${kind}`);
  return CADENCE_DAYS[kind];
}

/** Whole days between two ISO days. */
export function daysBetween(fromIso, toIso) {
  const a = Date.UTC(
    ...fromIso.split("-").map((n, i) => Number(n) - (i === 1 ? 1 : 0)),
  );
  const b = Date.UTC(
    ...toIso.split("-").map((n, i) => Number(n) - (i === 1 ? 1 : 0)),
  );
  return Math.round((b - a) / 86_400_000);
}

/**
 * Flags a source: { id, kind, readOn } against `today`. Returns
 * { id, kind, readOn, ageDays, cadence, stale, note }.
 */
export function flagSource(source, today) {
  const cadence = cadenceDays(source.kind);
  const ageDays = source.readOn ? daysBetween(source.readOn, today) : null;
  if (cadence === null)
    return {
      ...source,
      ageDays,
      cadence,
      stale: false,
      note: "re-read on each watch-changes run (the ledger is the proof)",
    };
  if (ageDays === null)
    return { ...source, ageDays, cadence, stale: true, note: "no read date" };
  const stale = ageDays > cadence;
  return {
    ...source,
    ageDays,
    cadence,
    stale,
    note: stale
      ? `re-fetch: ${ageDays} days old, cadence ${cadence}`
      : `within cadence (${ageDays} of ${cadence} days)`,
  };
}

export function flagSources(sources, today) {
  return sources.map((s) => flagSource(s, today));
}

/** The report lines: stale first, then the rest, then the count. */
export function cadenceReport(flags) {
  const stale = flags.filter((f) => f.stale);
  const lines = [...stale, ...flags.filter((f) => !f.stale)].map(
    (f) =>
      `${f.stale ? "RE-FETCH" : "ok      "} ${f.id} [${f.kind}] read ${f.readOn ?? "never"}: ${f.note}`,
  );
  lines.push(
    `cadence: ${stale.length} of ${flags.length} source(s) past their read cadence`,
  );
  return lines;
}
