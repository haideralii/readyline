import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PeriodSelector } from "@/components/period-selector";
import {
  PERIOD_COLUMNS,
  parsePeriodParams,
  periodContextFrom,
  resolvePeriod,
  undatedCount,
  type Period,
  type PeriodContext,
  type PeriodDefault,
  type PeriodRegister,
  type RawPeriodParams,
} from "@/lib/registers/period";
import { currentPeriod } from "@/server/registers/registration-queries";

/**
 * The period filter on a register page (REQ-023 FR-5; D-2318): the URL's
 * `period`, `from` and `to` against the account's registration dates, the
 * selector above the list with the count of undated rows, and the line a
 * filtered register shows when nothing falls in the period. The proxy has
 * refused a malformed query already; it is parsed again here so no value
 * reaches a query unparsed (SR-3), with the surface's default otherwise.
 */
export type PagePeriod = {
  period: Period;
  ctx: PeriodContext;
  unavailable: "period" | "since-last-audit" | null;
};

export async function pagePeriod(
  supabase: SupabaseClient,
  accountId: string,
  searchParams: Promise<RawPeriodParams> | RawPeriodParams,
  fallback: PeriodDefault = "all",
): Promise<PagePeriod> {
  const raw = await searchParams;
  const ctx = periodContextFrom(await currentPeriod(supabase, accountId));
  const parsed = parsePeriodParams(raw);
  return {
    ctx,
    ...resolvePeriod(parsed.ok ? parsed.selection : null, ctx, fallback),
  };
}

/** The selector above a register's list, with that register's undated count (D-2318 A). */
export function RegisterPeriodBar({
  basePath,
  register,
  rows,
  state,
}: {
  basePath: string;
  register: PeriodRegister;
  rows: readonly Record<string, unknown>[];
  state: PagePeriod;
}) {
  return (
    <PeriodSelector
      basePath={basePath}
      period={state.period}
      ctx={state.ctx}
      unavailable={state.unavailable}
      fallback="all"
      undated={undatedCount(rows, PERIOD_COLUMNS[register])}
    />
  );
}

/** A filtered register with no row in the period: not the register's empty state, and the way back to every entry. */
export function PeriodEmpty({
  basePath,
  testId,
}: {
  basePath: string;
  testId: string;
}) {
  return (
    <p
      className="text-slate mt-6 leading-7"
      data-testid={`${testId}-period-empty`}
    >
      Nothing recorded in this period.{" "}
      <Link href={basePath} className="underline underline-offset-4">
        Show all entries
      </Link>
    </p>
  );
}
