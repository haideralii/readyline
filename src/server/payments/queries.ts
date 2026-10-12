import "server-only";
/**
 * Reads for the documents and account pages (REQ-007 FR-6, FR-7, FR-8),
 * with the user's session so RLS applies: owners see their own purchases
 * and entitlements, members the job status.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EntitlementView,
  JobView,
  PurchaseView,
} from "@/lib/payments/documents-state";

export async function listPurchases(
  supabase: SupabaseClient,
  accountId: string,
): Promise<PurchaseView[]> {
  const r = await supabase
    .from("purchases")
    .select("id, status, amount_cents, receipt_url, created_at, refunded_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(50);
  type Row = {
    id: string;
    status: "paid" | "refunded";
    amount_cents: number;
    receipt_url: string | null;
    created_at: string;
    refunded_at: string | null;
  };
  return ((r.data as Row[] | null) ?? []).map((p) => ({
    id: p.id,
    status: p.status,
    amountCents: p.amount_cents,
    receiptUrl: p.receipt_url,
    createdAt: p.created_at,
    refundedAt: p.refunded_at,
  }));
}

export async function listEntitlements(
  supabase: SupabaseClient,
  accountId: string,
): Promise<EntitlementView[]> {
  const r = await supabase
    .from("entitlements")
    .select("id, source_purchase_id, version_set_id, granted_at, revoked_at")
    .eq("account_id", accountId)
    .eq("kind", "pack")
    .order("granted_at", { ascending: false })
    .limit(50);
  type Row = {
    id: string;
    source_purchase_id: string | null;
    version_set_id: string | null;
    granted_at: string;
    revoked_at: string | null;
  };
  return ((r.data as Row[] | null) ?? []).map((e) => ({
    id: e.id,
    sourcePurchaseId: e.source_purchase_id,
    versionSetId: e.version_set_id,
    grantedAt: e.granted_at,
    revokedAt: e.revoked_at,
  }));
}

export async function listGenerationJobs(
  supabase: SupabaseClient,
  accountId: string,
): Promise<JobView[]> {
  const r = await supabase
    .from("generation_jobs")
    .select("entitlement_id, status, next_document_index, version_set_id")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(50);
  type Row = {
    entitlement_id: string | null;
    status: JobView["status"];
    next_document_index: number;
    version_set_id: string | null;
  };
  return ((r.data as Row[] | null) ?? []).map((j) => ({
    entitlementId: j.entitlement_id,
    status: j.status,
    nextDocumentIndex: j.next_document_index,
    versionSetId: j.version_set_id,
  }));
}

/**
 * FR-8: a set that belongs to a revoked entitlement is kept but not served.
 * Sets with no entitlement (the free generate button) are unaffected.
 */
export async function isSetLocked(
  supabase: SupabaseClient,
  versionSetId: string,
): Promise<boolean> {
  const r = await supabase
    .from("entitlements")
    .select("revoked_at")
    .eq("version_set_id", versionSetId)
    .limit(1)
    .maybeSingle();
  return Boolean(r.data?.revoked_at);
}
