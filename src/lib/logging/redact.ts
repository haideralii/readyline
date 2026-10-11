/**
 * Redaction for anything that reaches a log line (REQ-002 FR-4; threat model
 * "Logs never contain free-text fields, tokens or emails in clear").
 *
 * Three layers, applied recursively:
 * 1. Keys that name secrets (password, token, api key, cookie, ...) are
 *    replaced wholesale, whatever their value.
 * 2. Keys that name free text (notes, description, message, answers, ...)
 *    are omitted, because register and questionnaire text could contain
 *    participant details the provider should never have typed.
 * 3. Every remaining string has emails and known token shapes masked.
 */

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const TOKEN_PATTERNS: RegExp[] = [
  /\b(?:sk|pk|rk|whsec)_(?:live|test)_[A-Za-z0-9]{8,}/g, // Stripe keys and webhook secrets
  /\bsk-ant-[A-Za-z0-9_-]{8,}/g, // Anthropic API keys
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, // JWTs (Supabase sessions)
  /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/gi,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, // AWS access keys
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, // GitHub tokens
  /\b[a-f0-9]{64}\b/g, // 32-byte hex secrets
];

const SENSITIVE_KEY =
  /(password|passwd|secret|token|api[-_]?key|authorization|cookie|session|credential|private[-_]?key|signature)/i;

const FREE_TEXT_KEY =
  /^(note|notes|description|details?|comments?|message|body|text|free_?text|narrative|summary|reason|answer|answers|content|html|markdown|prompt|completion)$/i;

export const REDACTED = "[redacted]";
export const OMITTED = "[free-text omitted]";
export const EMAIL_MASK = "[email]";

const MAX_DEPTH = 8;
const MAX_STRING = 2_000;

export function redactString(value: string): string {
  let out =
    value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  out = out.replace(EMAIL, EMAIL_MASK);
  for (const re of TOKEN_PATTERNS) out = out.replace(re, REDACTED);
  return out;
}

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY.test(key);
}

export function isFreeTextKey(key: string): boolean {
  return FREE_TEXT_KEY.test(key);
}

/**
 * Returns a copy of `value` safe to log. Never mutates the input.
 * Errors become `{ name, message }` with the message redacted and no stack.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[depth limit]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactString(value);
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  )
    return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message) };
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(key)) out[key] = REDACTED;
      else if (isFreeTextKey(key)) out[key] = OMITTED;
      else out[key] = redact(v, depth + 1);
    }
    return out;
  }
  return String(value);
}
