import "server-only";
/**
 * REQ-024 Session A3, the one-time fill's server side (FR-6b; SR-7, SR-8).
 * `performFill` reads the worker snapshot, builds the one file and writes
 * the count-only audit line; the typed values pass through `buildFillFile`
 * into the response body and nowhere else: no table, no log field, no error
 * report (the logger omits the fill keys by name as well, `redact.ts`).
 * The member gate is the owner's session; the subscription gate does not
 * apply, as it does not to the account export (D-2422; SR-8(m)).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "@/lib/logging/logger";
import {
  EXPORT_SCREEN_PATH,
  FILL_PATHS,
  buildFillFile,
  type FillFile,
  type FillSubmission,
} from "@/lib/registers/fill";
import { loadWorkerExportSnapshot, part4SectionFor } from "./worker-exports";
import { todaySydney } from "./worker-onboarding";

/**
 * SR-8(a): a fill is posted from the export screen and from nowhere else.
 * The Origin header must be the site's own when present (every browser
 * sends it on a form post), the fetch metadata must say same-origin when
 * present, and a Referer, when present, must be the export screen.
 */
export function postedFromExportScreen(request: Request): boolean {
  const origin = new URL(request.url).origin;
  const o = request.headers.get("origin");
  if (o !== null && o !== origin) return false;
  const site = request.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin") return false;
  const referer = request.headers.get("referer");
  if (referer !== null) {
    try {
      const r = new URL(referer);
      // The refused form posts again from the handler's own page (finding 76).
      const fromScreen = r.pathname === EXPORT_SCREEN_PATH;
      const fromRefusal = Object.values(FILL_PATHS).includes(r.pathname);
      if (r.origin !== origin || !(fromScreen || fromRefusal)) return false;
    } catch {
      return false;
    }
  }
  return true;
}

export type FillOutcome = { file: FillFile };

export async function performFill(input: {
  supabase: SupabaseClient;
  accountId: string;
  userId: string;
  submission: FillSubmission;
}): Promise<FillOutcome> {
  const { supabase, accountId, userId, submission } = input;
  const snapshot = await loadWorkerExportSnapshot(supabase, accountId, {
    today: todaySydney(),
    asAt: submission.asAt ?? undefined,
  });
  const file = buildFillFile(snapshot, submission, part4SectionFor);
  // SR-7: one audit line with the count, never a value; checked as the pack's is.
  const action = `exports.${submission.kind}.${submission.fill ? "filled" : "unfilled"}`;
  const audit = await supabase.from("audit_log").insert({
    account_id: accountId,
    actor_user_id: userId,
    action,
    target: accountId,
  });
  if (audit.error)
    log.warn("audit.write.failed", {
      accountId,
      action,
      code: audit.error.code,
    });
  log.info("exports.fill", {
    accountId,
    kind: submission.kind,
    filled: submission.fill,
    rows: file.count,
  });
  return { file };
}
