import "server-only";
/**
 * Admin client using the secret key, which bypasses row-level security.
 * Only webhooks, the purge job, the magic-link limiter and integration-test
 * setup may use it (REQ-004 FR-4; threat model "Identity, sessions, tenancy").
 * Never import this from anything reachable by a client bundle; `server-only`
 * makes that a build error.
 */
import { createClient } from "@supabase/supabase-js";
import { readSupabaseAdminEnv } from "./env";

export function createSupabaseAdminClient() {
  const { url, secretKey } = readSupabaseAdminEnv();
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
