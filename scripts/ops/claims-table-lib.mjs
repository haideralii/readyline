/**
 * REQ-012 FR-4b (AC-9, AC-16; D-2907, D-2908): builds the claims-and-sources
 * table from the extractor's sentences and the hand-kept mapping in
 * data/claims-sources.json. Every sentence the extractor found is a row;
 * a mapping entry (matched on the folded sentence) fills the source
 * columns and the status; a sentence with no entry is UNVERIFIED. Mapping
 * entries the extractor did not find (a fact with no digit, such as the
 * absence of an application fee) are rows too, marked hand-added. UNVERIFIED
 * rows come first and the first line carries both counts.
 */

export const COLUMNS = [
  "Sentence",
  "Route and file:line",
  "Claim type",
  "Primary instrument",
  "Source id and URL",
  "Source version",
  "Fetched",
  "Read by",
  "Last lawyer read",
  "Stale on",
  "Status",
];

export const STATUSES = [
  "UNVERIFIED",
  "CHANGED",
  "VERIFIED-SECONDARY",
  "VERIFIED",
];

const fold = (s) => s.replace(/\s+/g, " ").trim();

/** The claim type from the extractor's classes when the mapping gives none. */
export function typeFromClasses(classes) {
  if (classes.includes("dollar")) return "price";
  if (classes.includes("time")) return "time";
  if (classes.includes("hedge")) return "hedge (D-2911)";
  if (classes.includes("instrument") || classes.includes("date"))
    return "regulatory fact";
  return "regulatory fact";
}

/** One row from a found sentence and its mapping entry (or none). */
export function rowFor(found, entry) {
  const where = found
    ? `${found.file}:${found.line}`
    : (entry.where ??
      "(hand-added; no digit, date or instrument in the sentence)");
  const classes = found?.classes ?? [];
  const status = entry?.status ?? "UNVERIFIED";
  if (!STATUSES.includes(status)) throw new Error(`unknown status ${status}`);
  return {
    sentence: found?.sentence ?? entry.sentence,
    where,
    type: entry?.type ?? typeFromClasses(classes),
    instrument: entry?.instrument ?? "",
    source: entry?.sourceId
      ? `${entry.sourceId}${entry.url ? ` ${entry.url}` : ""}`
      : "",
    version: entry?.versionLabel ?? "",
    fetched: entry?.fetchedAt ?? "",
    readBy: entry?.readBy ?? "",
    lawyerRead: entry?.lawyerRead ?? "",
    staleOn: entry?.staleOn ?? "",
    status,
    note: entry?.note ?? "",
  };
}

/** Builds the rows: every found sentence, then the hand-added entries; UNVERIFIED first, then CHANGED, then the verified. */
export function buildRows(found, mapping) {
  const byKey = new Map(mapping.map((e) => [fold(e.sentence), e]));
  const used = new Set();
  const rows = [];
  for (const f of found) {
    const key = fold(f.sentence);
    const entry = byKey.get(key);
    if (entry) used.add(key);
    rows.push(rowFor(f, entry));
  }
  for (const e of mapping)
    if (!used.has(fold(e.sentence))) rows.push(rowFor(null, e));
  const rank = (s) => STATUSES.indexOf(s);
  const split = (where) => {
    const m = /^(.*):(\d+)$/.exec(where);
    return m ? [m[1], Number(m[2])] : [where, 0];
  };
  rows.sort((a, b) => {
    const r = rank(a.status) - rank(b.status);
    if (r) return r;
    const [fa, la] = split(a.where);
    const [fb, lb] = split(b.where);
    return fa.localeCompare(fb) || la - lb;
  });
  return rows;
}

const cell = (v) =>
  String(v ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ");

/** The markdown: the counts line, the header, the rows. */
export function renderTable(rows, meta) {
  const unverified = rows.filter((r) => r.status === "UNVERIFIED").length;
  const mapped = rows.length - unverified;
  const lines = [
    `UNVERIFIED ${unverified}, mapped ${mapped} (${rows.filter((r) => r.status === "VERIFIED").length} VERIFIED, ${rows.filter((r) => r.status === "VERIFIED-SECONDARY").length} VERIFIED-SECONDARY, ${rows.filter((r) => r.status === "CHANGED").length} CHANGED); ${rows.length} rows; extracted ${meta.extractedAt}; precision ${rows.length ? Math.round((100 * mapped) / rows.length) : 0} % (D-2907 columns; UNVERIFIED first, D-2908's facts among them by name).`,
    "",
    `| ${COLUMNS.join(" | ")} | Note |`,
    `| ${COLUMNS.map(() => "---").join(" | ")} | --- |`,
    ...rows.map(
      (r) =>
        `| ${[r.sentence, r.where, r.type, r.instrument, r.source, r.version, r.fetched, r.readBy, r.lawyerRead, r.staleOn, r.status, r.note].map(cell).join(" | ")} |`,
    ),
  ];
  return lines.join("\n");
}
