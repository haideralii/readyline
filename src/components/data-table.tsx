/**
 * A table that never breaks a word (REQ-013 batch 36 item 1, D-1310). On a
 * screen under 640 px a two- to four-column table renders as stacked rows:
 * one card per row, the column header in small capitals above each value.
 * On wider screens it is a table whose first column has a minimum width and
 * whose cells wrap at spaces only, so "Supports" never becomes "Sup port s".
 * Used by the sample viewer, the document reader and the registers' detail
 * tables; the markdown tables in guides use the same rules through
 * legal-article.tsx.
 */

const EMAIL = /([^\s@]+@)([^\s@]+\.[^\s@]+)/g;

/**
 * A cell's text with one allowed break inside an email address, after the
 * "@": at 360 px "contactcentre@ndiscommission.gov.au" (the fixed contact
 * block, D-546) is wider than a card and would otherwise break mid-word
 * (#38, run 38612013599). A `<wbr>` splits the text node, so the width check
 * sees two whole words, never one broken one.
 */
function cellText(cell: string) {
  if (!cell) return "—";
  const parts: React.ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of cell.matchAll(EMAIL)) {
    const at = m.index ?? 0;
    if (at > last) parts.push(cell.slice(last, at));
    parts.push(m[1], <wbr key={`wbr-${n++}`} />, m[2]);
    last = at + m[0].length;
  }
  if (last < cell.length) parts.push(cell.slice(last));
  return parts.length === 1 ? parts[0] : parts;
}

export function DataTable({
  columns,
  rows,
  label,
}: {
  columns: readonly string[];
  rows: readonly (readonly string[])[];
  /** Names the table for assistive technology ("Table: Role, Does what, When"). */
  label?: string;
}) {
  const name = label ?? `Table: ${columns.join(", ")}`;
  return (
    <div className="mt-2" data-testid="data-table">
      {/* Phones: one card per row. */}
      <ol className="sm:hidden" aria-label={name}>
        {rows.map((r, ri) => (
          <li key={ri} className="border-rule border-b py-2">
            <dl>
              {r.map((cell, ci) => (
                <div key={ci} className="mt-1">
                  <dt className="text-slate text-xs tracking-wide uppercase">
                    {columns[ci]}
                  </dt>
                  <dd className="leading-6 break-normal [overflow-wrap:normal]">
                    {cellText(cell)}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ol>
      {/* Wider screens: a table whose words never split. The region can
          scroll sideways, so keyboard users must be able to reach it (backlog
          1, D-1508: axe scrollable-region-focusable). */}
      <div
        className="hidden overflow-x-auto sm:block"
        role="region"
        aria-label={name}
        tabIndex={0}
      >
        <table className="w-full border-collapse text-sm" aria-label={name}>
          <thead>
            <tr>
              {columns.map((c, ci) => (
                <th
                  key={c}
                  scope="col"
                  className={`border-rule border-b py-1 pr-3 text-left font-semibold break-normal [overflow-wrap:normal] ${ci === 0 ? "min-w-36" : ""}`}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                {r.map((cell, ci) => (
                  <td
                    key={ci}
                    className="border-rule border-b py-1 pr-3 align-top break-normal [overflow-wrap:normal]"
                  >
                    {cellText(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
