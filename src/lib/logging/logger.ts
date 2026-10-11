/**
 * Structured JSON logger for server code (REQ-002 FR-4).
 *
 * One line per event, every field passed through `redact()`. App code must
 * use this instead of `console.*` (ESLint `no-console` is an error under
 * `src/`). Keep events short and stable ("stripe.webhook.received"), put
 * variable data in fields, and give users the `errorId` so support can find
 * the matching line without ever logging what they typed.
 */
import { randomUUID } from "node:crypto";
import { redact } from "./redact";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

type Sink = (line: string) => void;

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function defaultSink(level: LogLevel): Sink {
  return (line) => {
    const stream =
      LEVEL_RANK[level] >= LEVEL_RANK.warn ? process.stderr : process.stdout;
    stream.write(`${line}\n`);
  };
}

export function createLogger(
  options: {
    sink?: (level: LogLevel, line: string) => void;
    minLevel?: LogLevel;
    now?: () => Date;
  } = {},
) {
  const minLevel =
    options.minLevel ?? (process.env.NODE_ENV === "test" ? "error" : "info");
  const now = options.now ?? (() => new Date());
  const emit = (level: LogLevel, event: string, fields?: LogFields) => {
    if (LEVEL_RANK[level] < LEVEL_RANK[minLevel]) return;
    const record = {
      ts: now().toISOString(),
      level,
      event,
      ...(redact(fields ?? {}) as LogFields),
    };
    const line = JSON.stringify(record);
    if (options.sink) options.sink(level, line);
    else defaultSink(level)(line);
  };
  return {
    debug: (event: string, fields?: LogFields) => emit("debug", event, fields),
    info: (event: string, fields?: LogFields) => emit("info", event, fields),
    warn: (event: string, fields?: LogFields) => emit("warn", event, fields),
    error: (event: string, fields?: LogFields) => emit("error", event, fields),
  };
}

export const log = createLogger();

/** Short, URL-safe id to show the user and log alongside an error. */
export function newErrorId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 12);
}
