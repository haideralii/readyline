import Link from "next/link";
import {
  ALL_PERIOD,
  PERIOD_CHOICE_LABELS,
  periodLabel,
  periodQuery,
  periodUnavailableLine,
  periodUndatedLine,
  type Period,
  type PeriodContext,
  type PeriodDefault,
} from "@/lib/registers/period";

/**
 * The period selector (REQ-023 FR-5; D-2340): "Showing: <label>", the
 * choices as links (All; This registration period and Since the last audit
 * only when the account has those dates), and "Choose dates" as a GET form
 * of two dates, so it works with no script and the URL is the whole state.
 * Nothing is stored. Rendered above the list on the four register pages,
 * beside the pack link on the audit-day page and on the auditor's page.
 */
const CHIP =
  "inline-flex min-h-11 items-center rounded-md border px-3 text-sm underline-offset-4";
const CHIP_ON = "border-ink bg-ink text-paper";
const CHIP_OFF = "border-line hover:bg-mist";
const INPUT =
  "block min-h-12 rounded-md border border-line bg-surface px-3 py-2 text-base text-ink shadow-sm";

export function PeriodSelector({
  basePath,
  period,
  ctx,
  unavailable,
  fallback,
  undated = 0,
  testId = "period-selector",
}: {
  /** The page the links and the form return to. */
  basePath: string;
  period: Period;
  ctx: PeriodContext;
  unavailable: "period" | "since-last-audit" | null;
  /** The surface's default; a surface that defaults to the registration period names "all" explicitly. */
  fallback: PeriodDefault;
  /** D-2318 A: the rows shown that have no date in the period's column; the line is absent at zero. */
  undated?: number;
  testId?: string;
}) {
  const undatedLine = period.kind === "all" ? null : periodUndatedLine(undated);
  const explicitAll = fallback === "period";
  const choices = [
    {
      kind: "all" as const,
      href: `${basePath}${periodQuery(ALL_PERIOD, { explicitAll })}`,
    },
    ...(ctx.periodStart
      ? [{ kind: "period" as const, href: `${basePath}?period=period` }]
      : []),
    ...(ctx.lastAuditOn
      ? [
          {
            kind: "since-last-audit" as const,
            href: `${basePath}?period=since-last-audit`,
          },
        ]
      : []),
  ];
  const custom = period.kind === "custom";
  return (
    <nav
      aria-label="Period shown"
      className="mt-4 print:hidden"
      data-testid={testId}
      data-period={period.kind}
    >
      <p className="text-sm" data-testid={`${testId}-line`}>
        Showing: <span className="font-medium">{periodLabel(period)}</span>
      </p>
      {unavailable ? (
        <p
          className="text-slate mt-1 text-sm leading-6"
          data-testid={`${testId}-unavailable`}
        >
          {periodUnavailableLine(unavailable)}
        </p>
      ) : null}
      <ul className="mt-2 flex flex-wrap items-start gap-2">
        {choices.map((c) => (
          <li key={c.kind}>
            <Link
              href={c.href}
              aria-current={period.kind === c.kind ? "true" : undefined}
              className={`${CHIP} ${period.kind === c.kind ? CHIP_ON : CHIP_OFF}`}
              data-testid={`period-choice-${c.kind}`}
            >
              {PERIOD_CHOICE_LABELS[c.kind]}
            </Link>
          </li>
        ))}
        <li className="min-w-0">
          <details open={custom || undefined} data-testid="period-custom">
            <summary
              className={`${CHIP} cursor-pointer list-none ${custom ? CHIP_ON : CHIP_OFF}`}
              aria-current={custom ? "true" : undefined}
              data-testid="period-choice-custom"
            >
              {PERIOD_CHOICE_LABELS.custom}
            </summary>
            <form
              method="get"
              action={basePath}
              className="mt-2 flex flex-wrap items-end gap-3"
              data-testid="period-custom-form"
            >
              <input type="hidden" name="period" value="custom" />
              <label className="block text-sm">
                From
                <input
                  type="date"
                  name="from"
                  required
                  defaultValue={custom ? (period.from ?? "") : ""}
                  className={`${INPUT} mt-1`}
                />
              </label>
              <label className="block text-sm">
                To
                <input
                  type="date"
                  name="to"
                  required
                  defaultValue={custom ? (period.to ?? "") : ""}
                  className={`${INPUT} mt-1`}
                />
              </label>
              <button type="submit" className="btn-secondary">
                Show these dates
              </button>
            </form>
          </details>
        </li>
      </ul>
      {undatedLine ? (
        <p
          className="text-slate mt-2 text-sm leading-6"
          data-testid={`${testId}-undated`}
        >
          {undatedLine}
        </p>
      ) : null}
    </nav>
  );
}
