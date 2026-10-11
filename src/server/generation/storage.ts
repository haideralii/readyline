/**
 * Object paths and access for generated files (REQ-005 SR-4, AC-7). Every
 * path starts with the account id; the server refuses any path outside the
 * caller's account before Supabase is even asked, and the bucket's RLS
 * policy is the second lock.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const DOCUMENTS_BUCKET = "documents";
export const SIGNED_URL_SECONDS = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FILE = /^[a-z0-9][a-z0-9.-]{0,120}\.(docx|pdf|zip|json)$/i;

export function objectPath(
  accountId: string,
  versionSetId: string,
  file: string,
): string {
  if (!UUID.test(accountId) || !UUID.test(versionSetId) || !FILE.test(file)) {
    throw new Error("invalid object path parts");
  }
  return `${accountId}/${versionSetId}/${file}`;
}

/** True only when the path is well-formed and belongs to the account. */
export function isOwnedPath(path: string, accountId: string): boolean {
  const parts = path.split("/");
  if (parts.length !== 3) return false;
  const [account, set, file] = parts;
  return (
    UUID.test(account) &&
    account.toLowerCase() === accountId.toLowerCase() &&
    UUID.test(set) &&
    FILE.test(file)
  );
}

export async function uploadObject(
  admin: SupabaseClient,
  path: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  const r = await admin.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (r.error) throw new Error(`upload ${path}: ${r.error.message}`);
}

export async function downloadObject(
  admin: SupabaseClient,
  path: string,
): Promise<Uint8Array> {
  const r = await admin.storage.from(DOCUMENTS_BUCKET).download(path);
  if (r.error || !r.data)
    throw new Error(`download ${path}: ${r.error?.message ?? "no data"}`);
  return new Uint8Array(await r.data.arrayBuffer());
}

export async function signedDownloadUrl(
  admin: SupabaseClient,
  path: string,
  downloadName: string,
): Promise<string> {
  const r = await admin.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS, { download: downloadName });
  if (r.error || !r.data)
    throw new Error(`sign ${path}: ${r.error?.message ?? "no data"}`);
  return r.data.signedUrl;
}

export async function removePrefix(
  admin: SupabaseClient,
  prefix: string,
): Promise<number> {
  const listed = await admin.storage
    .from(DOCUMENTS_BUCKET)
    .list(prefix, { limit: 1000 });
  const names = (listed.data ?? []).map((o) => `${prefix}/${o.name}`);
  if (names.length === 0) return 0;
  const r = await admin.storage.from(DOCUMENTS_BUCKET).remove(names);
  return r.error ? 0 : names.length;
}
