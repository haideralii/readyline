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
          <li
            key={ri}
            className="border-b border-zinc-200 py-2 dark:border-zinc-800"
          >
            <dl>
              {r.map((cell, ci) => (
                <div key={ci} className="mt-1">
                  <dt className="text-slate text-xs tracking-wide uppercase">
                    {columns[ci]}
                  </dt>
                  <dd className="leading-6 break-normal [overflow-wrap:normal]">
                    {cell || "—"}
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
                  className={`border-b border-zinc-300 py-1 pr-3 text-left font-semibold break-normal [overflow-wrap:normal] dark:border-zinc-700 ${ci === 0 ? "min-w-36" : ""}`}
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
                    className="border-b border-zinc-200 py-1 pr-3 align-top break-normal [overflow-wrap:normal] dark:border-zinc-800"
                  >
                    {cell}
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
