/**
 * REQ-012 FR-4c (AC-10): the pure half of the off-site link check. Links
 * are collected from markdown (the guides, the legal pages, the sources
 * index) and from the About and AI pages' markdown; same-site and anchor
 * links are left out; each distinct URL is fetched once with one redirect
 * followed and its final URL and status recorded. The fetcher is injected
 * so the unit test runs without the network.
 */

const OWN_HOSTS = [
  "readyline.com.au",
  "readyline.au",
  "localhost",
  "readyline.example",
];

/** Every http(s) link in a markdown text, with its line. */
export function markdownLinks(text, file) {
  const out = [];
  text.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(
      /\]\((https?:\/\/[^)\s]+)\)|<(https?:\/\/[^>\s]+)>|(?<![("\]])(https?:\/\/[^\s)"'<>]+)/g,
    )) {
      const url = (m[1] ?? m[2] ?? m[3]).replace(/[.,;:]+$/, "");
      out.push({ file, line: i + 1, url });
    }
  });
  return out;
}

export function isOffSite(url) {
  try {
    const host = new URL(url).hostname;
    return !OWN_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/** The distinct off-site URLs with the places they appear. */
export function distinctOffSite(links) {
  const byUrl = new Map();
  for (const l of links) {
    if (!isOffSite(l.url)) continue;
    const list = byUrl.get(l.url) ?? [];
    list.push(`${l.file}:${l.line}`);
    byUrl.set(l.url, list);
  }
  return [...byUrl.entries()].map(([url, where]) => ({ url, where }));
}

/**
 * Fetches each URL once: `fetchOnce(url)` resolves to { status, location }
 * without following redirects; one redirect is followed here and the final
 * URL recorded (query strings dropped from what is printed, D-2913).
 */
export async function checkLinks(urls, fetchOnce) {
  const results = [];
  for (const { url, where } of urls) {
    let finalUrl = url;
    let status = 0;
    let hops = 0;
    let error = null;
    try {
      let r = await fetchOnce(url);
      status = r.status;
      if (r.status >= 300 && r.status < 400 && r.location) {
        hops = 1;
        finalUrl = new URL(r.location, url).toString();
        r = await fetchOnce(finalUrl);
        status = r.status;
      }
    } catch (e) {
      status = -1;
      const cause = e && typeof e === "object" && "cause" in e ? e.cause : null;
      error = `${String(e).slice(0, 80)}${cause ? ` / ${String(cause).slice(0, 80)}` : ""}`;
    }
    results.push({
      url: stripQuery(url),
      finalUrl: stripQuery(finalUrl),
      status,
      hops,
      where,
      ok: status === 200,
      error,
    });
  }
  return results;
}

export function stripQuery(url) {
  try {
    const u = new URL(url);
    u.search = "";
    return u.toString();
  } catch {
    return url;
  }
}

/** The report lines: one per link, non-200 first, then the count line. */
export function report(results) {
  const bad = results.filter((r) => !r.ok);
  const lines = [];
  for (const r of [...bad, ...results.filter((r) => r.ok)])
    lines.push(
      `${r.ok ? "ok  " : "FAIL"} ${r.status === -1 ? "ERR" : r.status} ${r.url}${r.hops ? ` -> ${r.finalUrl}` : ""} (${r.where.join(", ")})${r.error ? ` ${r.error}` : ""}`,
    );
  lines.push(
    bad.length === 0
      ? `links: ${results.length} off-site link(s), every final status 200`
      : `links: ${bad.length} of ${results.length} not 200`,
  );
  return lines;
}
