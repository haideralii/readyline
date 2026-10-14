/**
 * First-party counters (batch 45 item 12, D-2002): five events, counted per
 * day with no cookie, no identifier and no third party. The names are the
 * database CHECK's list; the sums are what /admin shows for the last 30 days.
 */
export const COUNTER_EVENTS = [
  "start-view",
  "result-shown",
  "buy-click",
  "subscribe-click",
  "finish-completed",
] as const;
export type CounterEvent = (typeof COUNTER_EVENTS)[number];

export const COUNTER_LABELS: Record<CounterEvent, string> = {
  "start-view": "Questionnaire started (page views of /start)",
  "result-shown": "Results shown",
  "buy-click": "Buy clicks",
  "subscribe-click": "Subscribe clicks",
  "finish-completed": "Packs finished",
};

export const COUNTER_WINDOW_DAYS = 30;

/** The Sydney calendar day for an instant, as ISO. */
export function sydneyDay(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** The first day of the window that ends today, inclusive. */
export function windowStart(today: string, days = COUNTER_WINDOW_DAYS): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d.toISOString().slice(0, 10);
}

/** Sums the rows per event; every event is present, zero when nothing was counted. */
export function sumCounters(
  rows: readonly { event: string; count: number }[],
): Record<CounterEvent, number> {
  const out = Object.fromEntries(COUNTER_EVENTS.map((e) => [e, 0])) as Record<
    CounterEvent,
    number
  >;
  for (const r of rows)
    if ((COUNTER_EVENTS as readonly string[]).includes(r.event))
      out[r.event as CounterEvent] += r.count;
  return out;
}
