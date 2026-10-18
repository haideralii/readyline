/**
 * REQ-012 SR-1 (D-2913, D-2926): the pure half of the report-author check.
 * `files` are { path, text }; `identities` are the names and emails `git
 * log` printed. A hit is any identity (two characters or more, matched
 * case-insensitively as a whole word for names and as a substring for
 * emails) or any email address shape inside a file. The lines name the file
 * and the count only, never the identity found.
 */
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

function escape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function checkReportAuthors(files, identities) {
  const names = [
    ...new Set(identities.filter((s) => !s.includes("@") && s.length >= 2)),
  ];
  const emails = [...new Set(identities.filter((s) => s.includes("@")))];
  const lines = [];
  let hits = 0;
  for (const f of files) {
    let count = 0;
    for (const n of names) {
      const re = new RegExp(
        `(^|[^A-Za-z0-9])${escape(n)}([^A-Za-z0-9]|$)`,
        "i",
      );
      if (re.test(f.text)) count++;
    }
    for (const e of emails)
      if (f.text.toLowerCase().includes(e.toLowerCase())) count++;
    const anyEmail = f.text.match(EMAIL) ?? [];
    // Fixture addresses the product itself prints are allowed: example.test, example.com.
    const realEmails = anyEmail.filter(
      (a) => !/@example\.(test|com|org)$/i.test(a),
    );
    count += realEmails.length;
    hits += count;
    lines.push(
      `${count === 0 ? "ok  " : "FAIL"} ${f.path} (${count} hit${count === 1 ? "" : "s"})`,
    );
  }
  lines.push(
    hits === 0
      ? `authors: ${files.length} file(s) carry no git-log name or email and no address`
      : `authors: ${hits} hit(s); roles, not people (D-2913)`,
  );
  return { ok: hits === 0, hits, lines };
}
