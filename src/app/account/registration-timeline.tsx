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
    <table className="mt-3 w-full text-sm" data-testid={testId}>
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="text-left text-zinc-600 dark:text-zinc-400">
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
      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {rows.map((r) => (
          <tr
            key={r.id}
            data-testid={`timeline-row-${r.id}`}
            data-date={r.date}
            data-source={r.source}
            className="align-top"
          >
            <th scope="row" className="py-2 pr-3 text-left font-normal">
              {r.label}
              {r.plain ? (
                <span className="block text-xs text-zinc-600 dark:text-zinc-400">
                  {r.plain}
                </span>
              ) : null}
            </th>
            <td className="py-2 pr-3 whitespace-nowrap">
              {formatLongDate(r.date)}
            </td>
            <td className="py-2 text-zinc-700 dark:text-zinc-300">
              {r.source}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
