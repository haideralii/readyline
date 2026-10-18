/**
 * Runs once when the Next.js server starts (REQ-002 FR-5, AC-4; REQ-007 AC-6).
 * A missing required variable stops the process with a message naming it,
 * rather than letting a half-configured deployment serve traffic; with a
 * live Stripe key, so does a display price that differs from the Price.
 * The Node-only work lives in dynamically imported modules so the Edge
 * compilation of this file stays free of Node API references.
 */
import { sentryEnabled, sentryOptions } from "./lib/ops/sentry";

export async function register() {
  // REQ-030 FR-1 (D-2865, D-2875): server-side error reporting on the Node and Edge runtimes when
  // SENTRY_DSN is set, from the pure options (every event scrubbed; no tracing, no replay, no PII);
  // unset is off, silently. No browser SDK and no withSentryConfig, so no client bundle, no CSP change.
  if (sentryEnabled(process.env)) {
    const Sentry = await import("@sentry/nextjs");
    const options = sentryOptions(process.env);
    if (options) Sentry.init(options);
  }
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { exitIfEnvInvalid } = await import("./lib/env-startup");
  exitIfEnvInvalid();
  const { checkPackPriceAtStartup } =
    await import("./lib/payments/price-startup");
  await checkPackPriceAtStartup();
}

/**
 * REQ-030 FR-1: an unhandled error in a route or page reaches Sentry tagged
 * with the request's errorId (Next's digest, the reference src/app/error.tsx
 * shows the reader), when reporting is on; otherwise nothing happens here and
 * Next's own log line stands.
 */
export const onRequestError = async (
  error: unknown,
  request: Parameters<typeof import("@sentry/nextjs").captureRequestError>[1],
  context: Parameters<typeof import("@sentry/nextjs").captureRequestError>[2],
) => {
  if (!sentryEnabled(process.env)) return;
  const Sentry = await import("@sentry/nextjs");
  const digest =
    typeof error === "object" && error && "digest" in error
      ? String((error as { digest?: unknown }).digest ?? "")
      : "";
  if (digest) Sentry.setTag("errorId", digest);
  Sentry.captureRequestError(error, request, context);
};
