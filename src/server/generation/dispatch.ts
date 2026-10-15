/**
 * Asking GitHub Actions to carry the paid generation chain (D-059, batch 37
 * item 1). The kicker workflow runs on a schedule as a safety net (every
 * thirty minutes until the token below is set, then hourly); when work
 * exists now (a pack was just paid for, or the documents page
 * found a stalled job) the app sends a `repository_dispatch` event and the
 * workflow starts within a minute and loops until the route answers
 * `more: false` or twenty minutes have passed.
 *
 * Needs GITHUB_DISPATCH_TOKEN, a fine-grained token for this repository
 * with Contents: read and write (the permission the endpoint requires,
 * GitHub REST docs "Permissions required for fine-grained personal access
 * tokens", checked 14 Oct 2026). Without it the dispatch is skipped with one
 * log line and the schedule picks the job up within thirty minutes. The
 * token is never logged.
 */
import { log } from "@/lib/logging/logger";

/** The repository the workflow lives in; the token is scoped to it alone. */
export const DISPATCH_REPO = "haideralii/readyline";
export const DISPATCH_EVENT = "generate";
const TIMEOUT_MS = 5_000;

export type DispatchOutcome = "dispatched" | "skipped" | "failed";

export async function dispatchGenerateWorkflow(input: {
  /** Who found the work: the log line carries it, so does the event payload. */
  reason: string;
  fetchImpl?: typeof fetch;
  env?: Record<string, string | undefined>;
  repo?: string;
}): Promise<DispatchOutcome> {
  const env = input.env ?? process.env;
  const token = env.GITHUB_DISPATCH_TOKEN?.trim();
  if (!token) {
    log.info("payments.generation.dispatch-skipped", {
      reason: "no-token",
      kicked_by: input.reason,
    });
    return "skipped";
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const repo = input.repo ?? DISPATCH_REPO;
  try {
    const response = await fetchImpl(
      `https://api.github.com/repos/${repo}/dispatches`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/vnd.github+json",
          "content-type": "application/json",
          "x-github-api-version": "2022-11-28",
        },
        body: JSON.stringify({
          event_type: DISPATCH_EVENT,
          client_payload: { reason: input.reason },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      },
    );
    if (response.status === 204) {
      log.info("payments.generation.dispatched", { kicked_by: input.reason });
      return "dispatched";
    }
    log.warn("payments.generation.dispatch-failed", {
      status: response.status,
      kicked_by: input.reason,
    });
    return "failed";
  } catch (e) {
    log.warn("payments.generation.dispatch-failed", {
      error: e instanceof Error ? e.name : "error",
      kicked_by: input.reason,
    });
    return "failed";
  }
}
