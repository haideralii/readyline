/**
 * The boot check's verdict on the payment routes (REQ-022 FR-3, D-2209).
 * `src/instrumentation.ts` runs the live-mode guards once per server process
 * and stores the conditions here; the checkout actions and the webhook
 * route answer "not available" or 404 while any condition stands, and the
 * rest of the site serves. Kept on globalThis so the module's identity
 * (dev bundles, route groups) cannot split the state.
 */
const KEY = "__readylinePaymentRefusal";

type Store = { [KEY]?: string[] };

export function setPaymentRefusal(conditions: string[]): void {
  (globalThis as unknown as Store)[KEY] = [...conditions];
}

/** The standing conditions, names only; empty means the payment routes serve. */
export function paymentRefusal(): string[] {
  return (globalThis as unknown as Store)[KEY] ?? [];
}
