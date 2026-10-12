import { describe, expect, it } from "vitest";
import {
  deriveDocumentsState,
  refundMailto,
  type EntitlementView,
  type JobView,
  type PurchaseView,
} from "./documents-state";

const purchase: PurchaseView = {
  id: "p1",
  status: "paid",
  amountCents: 39900,
  receiptUrl: "https://pay.stripe.example/r/1",
  createdAt: "2026-10-12T01:00:00Z",
  refundedAt: null,
};
const entitlement: EntitlementView = {
  id: "e1",
  sourcePurchaseId: "p1",
  versionSetId: null,
  grantedAt: "2026-10-12T01:00:00Z",
  revokedAt: null,
};
const job: JobView = {
  entitlementId: "e1",
  status: "queued",
  nextDocumentIndex: 0,
  versionSetId: null,
};

describe("documents page state (REQ-007 FR-5, FR-6, FR-8)", () => {
  it("is 'none' with nothing bought", () => {
    expect(
      deriveDocumentsState({ purchases: [], entitlements: [], jobs: [] }),
    ).toEqual({ kind: "none" });
  });

  it("is 'preparing' with the document count while the job runs, even before the job row exists", () => {
    expect(
      deriveDocumentsState({
        purchases: [purchase],
        entitlements: [entitlement],
        jobs: [],
      }),
    ).toEqual({ kind: "preparing", purchase, documentsDone: 0 });
    expect(
      deriveDocumentsState({
        purchases: [purchase],
        entitlements: [entitlement],
        jobs: [{ ...job, status: "running", nextDocumentIndex: 4 }],
      }),
    ).toEqual({ kind: "preparing", purchase, documentsDone: 4 });
  });

  it("is 'ready' once the entitlement or the job carries a version set", () => {
    expect(
      deriveDocumentsState({
        purchases: [purchase],
        entitlements: [{ ...entitlement, versionSetId: "vs1" }],
        jobs: [job],
      }),
    ).toEqual({ kind: "ready", purchase, versionSetId: "vs1" });
    expect(
      deriveDocumentsState({
        purchases: [purchase],
        entitlements: [entitlement],
        jobs: [{ ...job, status: "ready", versionSetId: "vs2" }],
      }),
    ).toEqual({ kind: "ready", purchase, versionSetId: "vs2" });
  });

  it("is 'delayed', never an error, when the job failed", () => {
    expect(
      deriveDocumentsState({
        purchases: [purchase],
        entitlements: [entitlement],
        jobs: [{ ...job, status: "failed" }],
      }),
    ).toEqual({ kind: "delayed", purchase });
  });

  it("is 'refunded' after a revoke, and 'none' again after a later refund of an older purchase only", () => {
    const refunded = {
      ...purchase,
      status: "refunded" as const,
      refundedAt: "2026-10-13T00:00:00Z",
    };
    expect(
      deriveDocumentsState({
        purchases: [refunded],
        entitlements: [{ ...entitlement, revokedAt: "2026-10-13T00:00:00Z" }],
        jobs: [job],
      }),
    ).toEqual({ kind: "refunded", purchase: refunded });
    // A newer active entitlement wins over an older refund.
    const second: PurchaseView = {
      ...purchase,
      id: "p2",
      createdAt: "2026-10-14T00:00:00Z",
    };
    expect(
      deriveDocumentsState({
        purchases: [refunded, second],
        entitlements: [
          { ...entitlement, revokedAt: "2026-10-13T00:00:00Z" },
          {
            ...entitlement,
            id: "e2",
            sourcePurchaseId: "p2",
            grantedAt: "2026-10-14T00:00:00Z",
            versionSetId: "vs9",
          },
        ],
        jobs: [],
      }),
    ).toEqual({ kind: "ready", purchase: second, versionSetId: "vs9" });
  });

  it("prefills the purchase id in the refund mailto and nothing else", () => {
    const href = refundMailto("hello@readyline.example", "p1");
    expect(href.startsWith("mailto:hello@readyline.example?subject=")).toBe(
      true,
    );
    expect(decodeURIComponent(href)).toContain("Refund request p1");
    expect(href).not.toMatch(/@example\.test|participant/);
  });
});
