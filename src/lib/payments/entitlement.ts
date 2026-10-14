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
  /** REQ-009 Session C: present on subscription events and on a subscription-mode checkout. */
  subscriptionId?: string | null;
  customerId?: string | null;
  /** Stripe's subscription status when the event carries one. */
  subscriptionStatus?: SubscriptionStatus | null;
  periodEnd?: string | null;
};

export type SubscriptionStatus =
  | "incomplete"
  | "incomplete_expired"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused";

export const SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
  "incomplete",
  "incomplete_expired",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
];

/** The statuses that end the entitlement (D-056): never past_due. */
export const REVOKING_STATUSES: readonly SubscriptionStatus[] = [
  "canceled",
  "unpaid",
  "incomplete_expired",
];
/** The statuses under which a subscription entitlement must exist and be unrevoked. */
export const ENTITLED_STATUSES: readonly SubscriptionStatus[] = [
  "active",
  "trialing",
  "past_due",
];

export type Subscription = {
  id: string;
  accountId: string;
  stripeSubscriptionId: string;
  customerId: string | null;
  status: SubscriptionStatus;
  entitlementId: string | null;
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
  subscriptions: readonly Subscription[];
};

export type ApplyOutcome =
  | "granted"
  | "duplicate"
  | "ignored"
  | "revoked"
  | "refunded_before_completion"
  | "refund_recorded"
  | "already_paid"
  | "invalid"
  | "subscription_granted"
  | "subscription_updated"
  | "subscription_revoked";

export const EMPTY_LEDGER: Ledger = {
  seenEventIds: [],
  purchases: [],
  entitlements: [],
  subscriptions: [],
};

const SUBSCRIPTION_TYPES = new Set<string>([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
]);

/** The status an event implies when it carries none of its own. */
function impliedStatus(event: PaymentEvent): SubscriptionStatus | null {
  if (COMPLETION_TYPES.has(event.type))
    return event.subscriptionStatus ?? "active";
  if (event.type === "customer.subscription.deleted") return "canceled";
  if (event.type === "invoice.payment_failed")
    return event.subscriptionStatus ?? "past_due";
  if (SUBSCRIPTION_TYPES.has(event.type))
    return event.subscriptionStatus ?? null;
  return null;
}

/**
 * The subscription rules (REQ-009 Session C, D-056), mirrored by the SQL
 * function `apply_stripe_subscription_event`: record what Stripe said; revoke
 * the entitlement only on canceled, unpaid or incomplete_expired; under
 * active, trialing or past_due make sure one unrevoked subscription
 * entitlement exists (a return to active after a revocation grants a new one).
 */
function applySubscriptionEvent(
  seen: Ledger,
  event: PaymentEvent,
  newId: () => string,
): { ledger: Ledger; outcome: ApplyOutcome } {
  const existing = seen.subscriptions.find(
    (s) => s.stripeSubscriptionId === event.subscriptionId,
  );
  const accountId = event.accountId ?? existing?.accountId ?? null;
  if (!accountId) return { ledger: seen, outcome: "invalid" };
  const status = impliedStatus(event);
  if (!status) return { ledger: seen, outcome: "ignored" };
  let sub: Subscription = existing
    ? {
        ...existing,
        status,
        customerId: event.customerId ?? existing.customerId,
      }
    : {
        id: newId(),
        accountId,
        stripeSubscriptionId: event.subscriptionId!,
        customerId: event.customerId ?? null,
        status,
        entitlementId: null,
      };
  let entitlements = seen.entitlements;
  let outcome: ApplyOutcome = "subscription_updated";
  if (REVOKING_STATUSES.includes(status)) {
    if (sub.entitlementId) {
      const live = entitlements.find(
        (e) => e.id === sub.entitlementId && !e.revokedAt,
      );
      if (live) {
        entitlements = entitlements.map((e) =>
          e === live ? { ...e, revokedAt: event.occurredAt } : e,
        );
        outcome = "subscription_revoked";
      }
    }
  } else if (ENTITLED_STATUSES.includes(status)) {
    const live = sub.entitlementId
      ? entitlements.find((e) => e.id === sub.entitlementId && !e.revokedAt)
      : undefined;
    if (!live) {
      const entitlement: Entitlement = {
        id: newId(),
        accountId,
        kind: "subscription",
        assessmentId: null,
        sourcePurchaseId: null,
        grantedAt: event.occurredAt,
        revokedAt: null,
      };
      entitlements = [...entitlements, entitlement];
      sub = { ...sub, entitlementId: entitlement.id };
      outcome = "subscription_granted";
    }
  }
  const subscriptions = existing
    ? seen.subscriptions.map((s) => (s === existing ? sub : s))
    : [...seen.subscriptions, sub];
  return { ledger: { ...seen, entitlements, subscriptions }, outcome };
}

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

  // A subscription-mode checkout and the subscription lifecycle events (Session C).
  if (event.subscriptionId) return applySubscriptionEvent(seen, event, newId);
  if (SUBSCRIPTION_TYPES.has(event.type))
    return { ledger: seen, outcome: "invalid" };

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

/** True when the account holds a subscription entitlement that has not been revoked (REQ-009). */
export function hasActiveSubscription(
  ledger: Pick<Ledger, "entitlements">,
  accountId: string,
): boolean {
  return ledger.entitlements.some(
    (e) =>
      e.accountId === accountId && e.kind === "subscription" && !e.revokedAt,
  );
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
