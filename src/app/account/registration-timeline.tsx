import { formatLongDate } from "@/lib/registers/status";
import type { TimelineRow } from "@/lib/registers/timeline";

/**
 * "Your registration timeline" (REQ-023 FR-2; D-2301): a table in the
 * product's voice, each row with its date and its source word, no colour for
 * "soon", no countdown. The account page shows every row with the position
 * sentence; the audit-day page shows the legal rows only (D-2314).
 */
export function RegistrationTimeline({
  rows,
  caption,
  testId,
}: {
  rows: readonly TimelineRow[];
  caption: string;
  testId: string;
}) {
  return (
    // #73's third run: at 360 px and 130% text the three columns overflowed the
    // viewport (scrollWidth 401), so the columns share the width and every
    // cell wraps, the date included.
    <table className="mt-3 w-full table-fixed text-sm" data-testid={testId}>
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="text-slate text-left">
          <th scope="col" className="py-1 pr-3 font-medium">
            What
          </th>
          <th scope="col" className="py-1 pr-3 font-medium">
            When
          </th>
          <th scope="col" className="py-1 font-medium">
            Where the date comes from
          </th>
        </tr>
      </thead>
      <tbody className="divide-rule divide-y">
        {rows.map((r) => (
          <tr
            key={r.id}
            data-testid={`timeline-row-${r.id}`}
            data-date={r.date}
            data-source={r.source}
            className="align-top"
          >
            <th
              scope="row"
              className="py-2 pr-3 text-left font-normal break-words"
            >
              {r.label}
              {r.plain ? (
                <span className="text-slate block text-sm">{r.plain}</span>
              ) : null}
            </th>
            <td className="py-2 pr-3 break-words">{formatLongDate(r.date)}</td>
            <td className="text-ink py-2 break-words">{r.source}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
