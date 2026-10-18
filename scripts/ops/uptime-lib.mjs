/**
 * The uptime check's rules (REQ-030 FR-3, D-2867), kept apart from the
 * command so the unit test drives them against stubs. Two probes, `/api/health`
 * (200 with `ok: true`) and `/` (200 carrying the brand name); a two-strike
 * count carried between runs in a small state file (actions/cache in the kick
 * job); on the second consecutive failure one issue `Site down <date>` is
 * opened through the GitHub API (reusing an open one); two consecutive passes
 * close it. Nothing here carries a URL with a token, an address or a value:
 * the issue's title and body are status codes and times only (SR-3).
 */

/** Reads both pages; never throws (a network error is a failed probe). */
export async function probe(baseUrl, brand, fetchImpl = globalThis.fetch) {
  const base = baseUrl.replace(/\/$/, "");
  const one = async (path, test) => {
    try {
      const r = await fetchImpl(`${base}${path}`, {
        redirect: "manual",
        headers: { "user-agent": "readyline-uptime/1" },
      });
      const text = await r.text();
      return { status: r.status, ok: r.status === 200 && test(text) };
    } catch {
      return { status: 0, ok: false };
    }
  };
  const health = await one("/api/health", (t) => {
    try {
      return JSON.parse(t).ok === true;
    } catch {
      return false;
    }
  });
  const home = await one("/", (t) => t.includes(brand));
  return { health, home, up: health.ok && home.ok };
}

/**
 * The judge: the previous strike count and this run's result in, the new
 * count and the one action out. Two failures in a row open; two passes in a
 * row close; a lone failure between passes opens nothing (AC-6).
 */
export function judge(previous, up) {
  const strikes = up ? 0 : (previous.strikes ?? 0) + 1;
  const passes = up ? (previous.passes ?? 0) + 1 : 0;
  let action = "none";
  if (!up && strikes === 2) action = "open";
  if (up && passes === 2 && previous.issueOpen) action = "close";
  const issueOpen =
    action === "open"
      ? true
      : action === "close"
        ? false
        : Boolean(previous.issueOpen) && !up
          ? true
          : Boolean(previous.issueOpen);
  return { strikes, passes, action, issueOpen };
}

/** The issue's words: status codes and the time, nothing else (SR-3). */
export function issueText(result, now = new Date()) {
  const date = now.toISOString().slice(0, 10);
  return {
    title: `Site down ${date}`,
    body: [
      `Two consecutive uptime checks failed at ${now.toISOString()}.`,
      `- /api/health: status ${result.health.status}${result.health.ok ? "" : " (not ok)"}`,
      `- /: status ${result.home.status}${result.home.ok ? "" : " (brand not found)"}`,
      "",
      "See product/ops/INCIDENTS.md section 1. This issue closes itself after two consecutive passes.",
    ].join("\n"),
  };
}

/** Opens or closes the issue through the GitHub API; one open issue at a time, reused. */
export async function applyIssueAction(
  { action, repository, token, result, now = new Date() },
  fetchImpl = globalThis.fetch,
) {
  if (action === "none" || !repository || !token) return { done: false };
  const api = `https://api.github.com/repos/${repository}/issues`;
  const headers = {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "user-agent": "readyline-uptime/1",
    "content-type": "application/json",
  };
  const list = await fetchImpl(`${api}?state=open&per_page=50`, { headers });
  const open = list.ok ? await list.json() : [];
  const existing = Array.isArray(open)
    ? open.find(
        (i) => typeof i.title === "string" && i.title.startsWith("Site down "),
      )
    : undefined;
  if (action === "open") {
    if (existing) return { done: true, reused: true, number: existing.number };
    const { title, body } = issueText(result, now);
    const created = await fetchImpl(api, {
      method: "POST",
      headers,
      body: JSON.stringify({ title, body }),
    });
    const issue = created.ok ? await created.json() : null;
    return { done: created.ok, reused: false, number: issue?.number };
  }
  if (!existing) return { done: false };
  const closed = await fetchImpl(`${api}/${existing.number}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      state: "closed",
      state_reason: "completed",
    }),
  });
  return { done: closed.ok, number: existing.number };
}

/** The route's report, one line in audit_log (D-2867): up and the two statuses. */
export async function report(
  { baseUrl, secret, result },
  fetchImpl = globalThis.fetch,
) {
  if (!secret) return { reported: false };
  const base = baseUrl.replace(/\/$/, "");
  const q = new URLSearchParams({
    up: result.up ? "true" : "false",
    health: String(result.health.status),
    home: String(result.home.status),
  });
  try {
    const r = await fetchImpl(`${base}/api/jobs/uptime?${q}`, {
      headers: { authorization: `Bearer ${secret}` },
    });
    return { reported: r.ok, status: r.status };
  } catch {
    return { reported: false, status: 0 };
  }
}
