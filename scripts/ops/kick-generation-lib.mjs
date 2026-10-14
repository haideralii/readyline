/**
 * The kicker's loop (batch 32 item 1, D-1006), kept apart from the command
 * so the unit test drives it against a stub server. Calls the generation
 * job route until it answers `more: false`, an error, or the time box.
 *
 * A call that overlaps a live chain claims no job (the claim is skip-locked
 * and leased) and answers `more: false`, so an overlapping kick is a no-op.
 */
export async function kickUntilDrained({
  url,
  secret,
  maxSeconds = 240,
  perCallTimeoutMs = 295_000,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  log = (line) => console.log(line),
}) {
  const started = now();
  const calls = [];
  for (;;) {
    const response = await fetchImpl(`${url}/api/jobs/generate?kick=kicker`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${secret}`,
        accept: "application/json",
      },
      signal: AbortSignal.timeout(perCallTimeoutMs),
    });
    if (!response.ok) {
      log(`kick ${calls.length + 1}: HTTP ${response.status}`);
      return { ok: false, calls, reason: `http-${response.status}` };
    }
    const body = await response.json();
    const runs = Array.isArray(body.runs) ? body.runs.length : 0;
    const more = body.more === true;
    calls.push({ more, runs });
    log(
      `kick ${calls.length}: runs=${runs} more=${more}${body.skipped ? ` skipped=${body.skipped}` : ""}`,
    );
    if (!more) return { ok: true, calls, reason: "drained" };
    if ((now() - started) / 1000 >= maxSeconds)
      return { ok: true, calls, reason: "time-box" };
  }
}
