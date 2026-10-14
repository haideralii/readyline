/**
 * What the documents page shows for an account's purchases (REQ-007 FR-5,
 * FR-6, FR-8), as a pure decision over the rows so it is unit-tested. The
 * page never shows an error code: a job that failed reads as "we are
 * preparing your documents and will email you".
 */

export type PurchaseView = {
  id: string;
  status: "paid" | "refunded";
  amountCents: number;
  receiptUrl: string | null;
  createdAt: string;
  refundedAt: string | null;
};

export type EntitlementView = {
  id: string;
  sourcePurchaseId: string | null;
  versionSetId: string | null;
  grantedAt: string;
  revokedAt: string | null;
};

export type JobView = {
  entitlementId: string | null;
  /** "attention" (REQ-021 S4): one or more documents need another go and the owner decides. */
  status: "queued" | "running" | "ready" | "failed" | "attention";
  nextDocumentIndex: number;
  versionSetId: string | null;
  /** When the job row last changed; the page uses it to notice a stalled chain (batch 23 item 4). */
  updatedAt?: string;
};

/** A job that has not moved for this long is nudged by the documents page itself (D-1005). */
export const STALL_AFTER_MS = 90_000;

/** True when a queued or running job has shown no progress for STALL_AFTER_MS. */
export function isJobStalled(job: JobView | undefined, now: Date): boolean {
  if (!job || !job.updatedAt) return false;
  if (job.status !== "queued" && job.status !== "running") return false;
  return now.getTime() - new Date(job.updatedAt).getTime() >= STALL_AFTER_MS;
}

export type DocumentsState =
  | { kind: "none" }
  | {
      kind: "preparing";
      purchase: PurchaseView | null;
      documentsDone: number;
      /** The job row behind the state, so the page can watch for a stall. */
      job: JobView | null;
    }
  | { kind: "delayed"; purchase: PurchaseView | null }
  | { kind: "ready"; purchase: PurchaseView | null; versionSetId: string }
  | { kind: "refunded"; purchase: PurchaseView };

function newest<T extends { grantedAt?: string; createdAt?: string }>(
  rows: T[],
  key: (r: T) => string,
): T | null {
  return rows.length === 0
    ? null
    : [...rows].sort((a, b) => key(b).localeCompare(key(a)))[0];
}

export function deriveDocumentsState(input: {
  purchases: PurchaseView[];
  entitlements: EntitlementView[];
  jobs: JobView[];
}): DocumentsState {
  const active = input.entitlements.filter((e) => !e.revokedAt);
  const entitlement = newest(active, (e) => e.grantedAt);
  if (entitlement) {
    const purchase =
      input.purchases.find((p) => p.id === entitlement.sourcePurchaseId) ??
      null;
    if (entitlement.versionSetId)
      return {
        kind: "ready",
        purchase,
        versionSetId: entitlement.versionSetId,
      };
    const job = input.jobs.find((j) => j.entitlementId === entitlement.id);
    if (job?.status === "ready" && job.versionSetId)
      return { kind: "ready", purchase, versionSetId: job.versionSetId };
    if (job?.status === "failed") return { kind: "delayed", purchase };
    return {
      kind: "preparing",
      purchase,
      documentsDone: job?.nextDocumentIndex ?? 0,
      job: job ?? null,
    };
  }
  const latest = newest(input.purchases, (p) => p.createdAt);
  if (latest?.status === "refunded")
    return { kind: "refunded", purchase: latest };
  return { kind: "none" };
}

/** The mailto for "request a refund" (FR-6): the purchase id prefilled, nothing about the customer. */
export function refundMailto(contactEmail: string, purchaseId: string): string {
  const subject = encodeURIComponent(`Refund request ${purchaseId}`);
  const body = encodeURIComponent(
    `Purchase reference: ${purchaseId}\n\nI would like a refund for the document pack.\n`,
  );
  return `mailto:${contactEmail}?subject=${subject}&body=${body}`;
}
