/**
 * The payment store interface and its in-memory implementation (REQ-007
 * FR-3). The webhook handler only ever calls `applyEvent`; in production the
 * Supabase store runs the `apply_stripe_event` function, in tests and in the
 * fake Stripe mode this store runs the reducer. Both answer with the same
 * outcome names.
 */
import { randomUUID } from "node:crypto";
import {
  applyStripeEvent,
  EMPTY_LEDGER,
  type ApplyOutcome,
  type Ledger,
  type PaymentEvent,
} from "./entitlement";

export interface PaymentStore {
  applyEvent(event: PaymentEvent): Promise<ApplyOutcome>;
}

export class MemoryPaymentStore implements PaymentStore {
  ledger: Ledger = EMPTY_LEDGER;
  readonly outcomes: ApplyOutcome[] = [];
  async applyEvent(event: PaymentEvent): Promise<ApplyOutcome> {
    const r = applyStripeEvent(this.ledger, event, () => randomUUID());
    this.ledger = r.ledger;
    this.outcomes.push(r.outcome);
    return r.outcome;
  }
}
