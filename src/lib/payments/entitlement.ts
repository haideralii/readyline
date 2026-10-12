/**
 * The entitlement state machine (REQ-007 FR-3, FR-4, SR-2), as a pure
 * reducer so the webhook's behaviour is unit-tested without Stripe or a
 * database. The SQL function `apply_stripe_event` (Session B) applies the
 * same rules atomically in Postgres; this module is its specification and
 * the fake store's implementation.
 *
 * Rules:
 * - an event id already seen is a duplicate and changes nothing;
 * - a completed (or async-succeeded) checkout records a paid purchase and
 *   grants one pack entitlement, unless a refund for the same payment intent
 *   arrived first, in which case the purchase is recorded as refunded and no
 *   entitlement is granted;
 * - a refund marks the purchase refunded and revokes its entitlement; a refund
 *   for an unknown payment intent records a refunded shell so a later
 *   completion cannot grant;
 * - every other event type is ignored (its id is still recorded).
 */

export type StripeEventKind =
  | "checkout.session.completed"
  | "checkout.session.async_payment_succeeded"
  | "charge.refunded"
  | (string & {});

export type PaymentEvent = {
  id: string;
  type: StripeEventKind;
  sessionId?: string | null;
  paymentIntentId?: string | null;
  accountId?: string | null;
  assessmentId?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  receiptUrl?: string | null;
  occurredAt: string;
};

export type Purchase = {
  id: string;
  accountId: string;
  sessionId: string | null;
  paymentIntentId: string | null;
  amountCents: number;
  currency: string;
  status: "paid" | "refunded";
  receiptUrl: string | null;
  createdAt: string;
  refundedAt: string | null;
};

export type Entitlement = {
  id: string;
  accountId: string;
  kind: "pack" | "subscription";
  assessmentId: string | null;
  sourcePurchaseId: string | null;
  grantedAt: string;
  revokedAt: string | null;
};

export type Ledger = {
  seenEventIds: readonly string[];
  purchases: readonly Purchase[];
  entitlements: readonly Entitlement[];
};

export type ApplyOutcome =
  | "granted"
  | "duplicate"
  | "ignored"
  | "revoked"
  | "refunded_before_completion"
  | "refund_recorded"
  | "already_paid"
  | "invalid";

export const EMPTY_LEDGER: Ledger = {
  seenEventIds: [],
  purchases: [],
  entitlements: [],
};

const COMPLETION_TYPES = new Set<string>([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

/** Applies one event; returns the new ledger and what happened. `newId` supplies row ids (uuid in production). */
export function applyStripeEvent(
  ledger: Ledger,
  event: PaymentEvent,
  newId: () => string,
): { ledger: Ledger; outcome: ApplyOutcome } {
  if (ledger.seenEventIds.includes(event.id))
    return { ledger, outcome: "duplicate" };
  const seen = { ...ledger, seenEventIds: [...ledger.seenEventIds, event.id] };

  if (COMPLETION_TYPES.has(event.type)) {
    if (!event.sessionId || !event.accountId)
      return { ledger: seen, outcome: "invalid" };
    const bySession = seen.purchases.find(
      (p) => p.sessionId === event.sessionId,
    );
    if (bySession) return { ledger: seen, outcome: "already_paid" };
    const refundedFirst = event.paymentIntentId
      ? seen.purchases.find(
          (p) =>
            p.paymentIntentId === event.paymentIntentId &&
            p.status === "refunded",
        )
      : undefined;
    if (refundedFirst) {
      // Fill in the session on the refunded shell; grant nothing.
      const purchases = seen.purchases.map((p) =>
        p === refundedFirst
          ? {
              ...p,
              sessionId: event.sessionId!,
              amountCents: event.amountCents ?? p.amountCents,
              receiptUrl: event.receiptUrl ?? p.receiptUrl,
            }
          : p,
      );
      return {
        ledger: { ...seen, purchases },
        outcome: "refunded_before_completion",
      };
    }
    const purchase: Purchase = {
      id: newId(),
      accountId: event.accountId,
      sessionId: event.sessionId,
      paymentIntentId: event.paymentIntentId ?? null,
      amountCents: event.amountCents ?? 0,
      currency: (event.currency ?? "aud").toLowerCase(),
      status: "paid",
      receiptUrl: event.receiptUrl ?? null,
      createdAt: event.occurredAt,
      refundedAt: null,
    };
    const entitlement: Entitlement = {
      id: newId(),
      accountId: event.accountId,
      kind: "pack",
      assessmentId: event.assessmentId ?? null,
      sourcePurchaseId: purchase.id,
      grantedAt: event.occurredAt,
      revokedAt: null,
    };
    return {
      ledger: {
        ...seen,
        purchases: [...seen.purchases, purchase],
        entitlements: [...seen.entitlements, entitlement],
      },
      outcome: "granted",
    };
  }

  if (event.type === "charge.refunded") {
    if (!event.paymentIntentId) return { ledger: seen, outcome: "invalid" };
    const purchase = seen.purchases.find(
      (p) => p.paymentIntentId === event.paymentIntentId,
    );
    if (!purchase) {
      if (!event.accountId) return { ledger: seen, outcome: "invalid" };
      const shell: Purchase = {
        id: newId(),
        accountId: event.accountId,
        sessionId: null,
        paymentIntentId: event.paymentIntentId,
        amountCents: event.amountCents ?? 0,
        currency: (event.currency ?? "aud").toLowerCase(),
        status: "refunded",
        receiptUrl: null,
        createdAt: event.occurredAt,
        refundedAt: event.occurredAt,
      };
      return {
        ledger: { ...seen, purchases: [...seen.purchases, shell] },
        outcome: "refund_recorded",
      };
    }
    const purchases = seen.purchases.map((p) =>
      p === purchase
        ? {
            ...p,
            status: "refunded" as const,
            refundedAt: p.refundedAt ?? event.occurredAt,
          }
        : p,
    );
    const entitlements = seen.entitlements.map((e) =>
      e.sourcePurchaseId === purchase.id && !e.revokedAt
        ? { ...e, revokedAt: event.occurredAt }
        : e,
    );
    return {
      ledger: { ...seen, purchases, entitlements },
      outcome: purchase.status === "refunded" ? "duplicate" : "revoked",
    };
  }

  return { ledger: seen, outcome: "ignored" };
}

/** True when the account holds a pack entitlement that has not been revoked. */
export function hasActivePack(
  ledger: Pick<Ledger, "entitlements">,
  accountId: string,
): boolean {
  return ledger.entitlements.some(
    (e) => e.accountId === accountId && e.kind === "pack" && !e.revokedAt,
  );
}
