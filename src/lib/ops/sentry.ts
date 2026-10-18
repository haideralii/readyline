/**
 * REQ-030 FR-1 (D-2865, D-2875): the server-side error reporting's options,
 * pure, so the init in `src/instrumentation.ts` is one call and every rule
 * here is unit-tested without the SDK. No DSN means off, silently. Every
 * event passes `scrubEvent` before it leaves: `redact()` over the message,
 * the exception values, the breadcrumbs, the request headers and `extra`;
 * `user`, cookies, body and query stripped; the request URL's path segments
 * redacted (D-2875). No browser SDK, no tracing, no replay (D-2865).
 */
import { redact, redactString } from "@/lib/logging/redact";

/** The slice of a Sentry event this module reads and rewrites; the SDK's own type is wider. */
export type ScrubbableEvent = {
  message?: string;
  exception?: { values?: { type?: string; value?: string }[] };
  breadcrumbs?: {
    message?: string;
    data?: Record<string, unknown>;
    category?: string;
  }[];
  request?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    cookies?: unknown;
    data?: unknown;
    query_string?: unknown;
  };
  user?: unknown;
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  tags?: Record<string, unknown>;
};

export type SentryOptions = {
  dsn: string;
  environment: string;
  release: string | undefined;
  sampleRate: 1;
  tracesSampleRate: 0;
  sendDefaultPii: false;
  beforeSend: <E extends ScrubbableEvent>(event: E) => E;
};

export function sentryEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(env.SENTRY_DSN?.trim());
}

/** The init options, or null when SENTRY_DSN is unset (then nothing is initialised). */
export function sentryOptions(
  env: Record<string, string | undefined> = process.env,
): SentryOptions | null {
  const dsn = env.SENTRY_DSN?.trim();
  if (!dsn) return null;
  return {
    dsn,
    environment: env.VERCEL_ENV?.trim() || "development",
    release: env.VERCEL_GIT_COMMIT_SHA?.trim() || undefined,
    sampleRate: 1,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  };
}

/** A URL with every path segment that is not a plain word replaced, and no query (D-2875). */
export function redactUrl(url: string): string {
  try {
    const u = new URL(url, "http://placeholder.invalid");
    const path = u.pathname
      .split("/")
      .map((seg) =>
        seg === "" || /^[a-z][a-z0-9-]*$/i.test(seg) ? seg : "[redacted]",
      )
      .join("/");
    const origin = u.host === "placeholder.invalid" ? "" : u.origin;
    return `${origin}${path}`;
  } catch {
    return "[redacted]";
  }
}

const HEADER_KEEP = new Set(["content-type", "accept", "user-agent", "host"]);

/**
 * The `beforeSend` hook: returns a copy of the event with nothing a log line
 * may not carry (threat model; CLAUDE.md 4.5). Never mutates the input.
 */
export function scrubEvent<E extends ScrubbableEvent>(event: E): E {
  const out: ScrubbableEvent = { ...event };
  delete out.user;
  if (typeof out.message === "string") out.message = redactString(out.message);
  if (out.exception?.values)
    out.exception = {
      ...out.exception,
      values: out.exception.values.map((v) => ({
        ...v,
        value: typeof v.value === "string" ? redactString(v.value) : v.value,
      })),
    };
  if (out.breadcrumbs)
    out.breadcrumbs = out.breadcrumbs.map((b) => ({
      ...b,
      message:
        typeof b.message === "string" ? redactString(b.message) : b.message,
      data: b.data ? (redact(b.data) as Record<string, unknown>) : b.data,
    }));
  if (out.request) {
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(out.request.headers ?? {}))
      if (HEADER_KEEP.has(k.toLowerCase())) headers[k] = redactString(v);
    out.request = {
      ...(out.request.method ? { method: out.request.method } : {}),
      ...(out.request.url ? { url: redactUrl(out.request.url) } : {}),
      headers,
    };
  }
  if (out.extra) out.extra = redact(out.extra) as Record<string, unknown>;
  if (out.contexts)
    out.contexts = redact(out.contexts) as Record<string, unknown>;
  return out as E;
}
