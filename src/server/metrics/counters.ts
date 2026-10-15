import "server-only";
/**
 * Bumping and reading the first-party counters (batch 45 item 12, D-2002).
 * A bump never throws and never blocks a page: it runs with the service key
 * after the response, and a failure is one warning in the log.
 */
import { after } from "next/server";
import { log } from "@/lib/logging/logger";
import {
  COUNTER_EVENTS,
  type CounterEvent,
  sumCounters,
  sydneyDay,
  windowStart,
} from "@/lib/metrics/counters";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

async function bump(event: CounterEvent): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const r = await admin.rpc("bump_counter", {
      p_event: event,
      p_day: sydneyDay(),
    });
    if (r.error)
      log.warn("counters.bump.failed", { event, code: r.error.code });
  } catch (e) {
    log.warn("counters.bump.failed", { event, error: e });
  }
}

/** Counts the event once the response has gone out; safe to call from a page or an action. */
export function countEvent(event: CounterEvent): void {
  try {
    after(() => bump(event));
  } catch {
    // Outside a request (a test, a script): count now and do not wait.
    void bump(event);
  }
}

/** The five sums for the last 30 Sydney days, for /admin. */
export async function countersLast30Days(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  today = sydneyDay(),
): Promise<Record<CounterEvent, number> | null> {
  const r = await admin
    .from("daily_counters")
    .select("event, count")
    .gte("day", windowStart(today))
    .lte("day", today)
    .in("event", [...COUNTER_EVENTS]);
  if (r.error) return null;
  return sumCounters((r.data as { event: string; count: number }[]) ?? []);
}
