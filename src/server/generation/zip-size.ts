import "server-only";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { DOCUMENTS_BUCKET, objectPath } from "./storage";

/**
 * REQ-028 FR-7 (D-2275 (4)): the stored set.zip's size in bytes from the
 * bucket's object metadata, or null when the object is missing or the
 * store cannot be asked (the page then shows the count without a size).
 */
export async function setZipSize(
  accountId: string,
  setId: string,
): Promise<number | null> {
  try {
    const path = objectPath(accountId, setId, "set.zip");
    const prefix = path.slice(0, path.lastIndexOf("/"));
    const admin = createSupabaseAdminClient();
    const r = await admin.storage
      .from(DOCUMENTS_BUCKET)
      .list(prefix, { limit: 10, search: "set.zip" });
    const hit = (r.data ?? []).find((o) => o.name === "set.zip");
    const size = (hit?.metadata as { size?: unknown } | null | undefined)?.size;
    return typeof size === "number" && size >= 0 ? size : null;
  } catch {
    return null;
  }
}
