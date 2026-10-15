import "server-only";
/**
 * The Start here sheet for the page and the download (REQ-026): the set's
 * rows read with the caller's client (RLS), then the pure builder.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { listAdoptedTypeIds } from "@/server/path/state";
import { hasActiveSubscription } from "@/server/registers/queries";
import { listFirstDocuments, listLatestDocuments } from "./queries";
import { startHereFromRows, type StartHereBuilt } from "./start-here";
import type { VersionSetRow } from "./store";

export async function startHereForSet(
  supabase: SupabaseClient,
  set: VersionSetRow,
): Promise<StartHereBuilt | null> {
  const [first, latest, adopted, subscribed] = await Promise.all([
    listFirstDocuments(supabase, set.id),
    listLatestDocuments(supabase, set.id),
    listAdoptedTypeIds(supabase, set.account_id),
    hasActiveSubscription(supabase, set.account_id),
  ]);
  return startHereFromRows({
    set,
    first,
    latest,
    adopted,
    subscribed,
    summaryVersion: "1",
  });
}
