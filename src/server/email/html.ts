import { siteUrl } from "@/lib/site";

/**
 * REQ-022 FR-7: the one HTML alternative every email carries, rendered from
 * the template's plain text so the two parts cannot drift. Paragraphs from
 * blank lines, a list from lines that start with "- ", one link per URL
 * under the site's own origin and nothing else: no image, no pixel, no
 * style, no off-site link (an off-site URL stays as text). The text part
 * is the message; this is the same message for a client that prefers HTML.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const URL = /https?:\/\/[^\s<>"]+/g;

/** A line with its on-site URLs as links; everything else escaped text. */
export function inlineHtml(line: string, origin: string): string {
  let out = "";
  let last = 0;
  for (const m of line.matchAll(URL)) {
    const at = m.index ?? 0;
    out += escapeHtml(line.slice(last, at));
    const url = m[0].replace(/[.,;:)]+$/, "");
    const trail = m[0].slice(url.length);
    out +=
      url === origin || url.startsWith(`${origin}/`)
        ? `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`
        : escapeHtml(url);
    out += escapeHtml(trail);
    last = at + m[0].length;
  }
  return out + escapeHtml(line.slice(last));
}

export function renderHtml(text: string, origin: string = siteUrl()): string {
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(
        `<ul>${list.map((l) => `<li>${inlineHtml(l, origin)}</li>`).join("")}</ul>`,
      );
      list = [];
    }
    if (paragraph.length) {
      blocks.push(
        `<p>${paragraph.map((l) => inlineHtml(l, origin)).join("<br>")}</p>`,
      );
      paragraph = [];
    }
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (line === "") {
      flush();
      continue;
    }
    if (/^- /.test(line)) {
      if (paragraph.length) flush();
      list.push(line.slice(2));
      continue;
    }
    if (list.length) flush();
    paragraph.push(line);
  }
  flush();
  return `<!doctype html><html lang="en-AU"><head><meta charset="utf-8"></head><body>${blocks.join("")}</body></html>`;
}
