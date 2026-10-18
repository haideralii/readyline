/**
 * The data promises check's rule (REQ-030 FR-5, AC-9; D-2869): the newest
 * `jobs.purge.ran` row must be at most two days old. Pure, so the unit test
 * drives it with dates; the command reads the row through psql in the
 * workflow and exits with the judge's code, naming the age.
 */
export const MAX_PURGE_AGE_DAYS = 2;

/** `latestAt` is the row's timestamp as psql prints it (or empty when there is no row). */
export function judgePurgeAge(latestAt, now = new Date()) {
  const trimmed = (latestAt ?? "").trim();
  if (!trimmed)
    return {
      ok: false,
      ageDays: null,
      line: "FAIL no jobs.purge.ran row exists; the purge job has never recorded a run (DEPLOY.md section 8).",
    };
  // psql prints "2026-10-18 03:00:00.123456+00": the space becomes T, microseconds are cut to
  // milliseconds, and a bare hour offset gains its minutes, so Date.parse reads it.
  const iso = trimmed
    .replace(" ", "T")
    .replace(/(\.\d{3})\d+/, "$1")
    .replace(/([+-]\d{2})$/, "$1:00");
  const t = Date.parse(iso);
  if (Number.isNaN(t))
    return {
      ok: false,
      ageDays: null,
      line: `FAIL the newest purge run's time could not be read: ${trimmed}`,
    };
  const ageDays = (now.getTime() - t) / 86_400_000;
  const rounded = Math.round(ageDays * 10) / 10;
  if (ageDays > MAX_PURGE_AGE_DAYS)
    return {
      ok: false,
      ageDays,
      line: `FAIL the newest purge run is ${rounded} days old, over the ${MAX_PURGE_AGE_DAYS}-day promise; check Vercel, Settings, Cron Jobs, and CRON_SECRET (INCIDENTS.md section 2).`,
    };
  return {
    ok: true,
    ageDays,
    line: `ok   the newest purge run is ${rounded} days old`,
  };
}
