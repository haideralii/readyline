import { describe, expect, it } from "vitest";
import { createLogger, newErrorId } from "./logger";
import { EMAIL_MASK, OMITTED, REDACTED } from "./redact";

function capture() {
  const lines: { level: string; record: Record<string, unknown> }[] = [];
  const logger = createLogger({
    sink: (level, line) => lines.push({ level, record: JSON.parse(line) }),
    minLevel: "debug",
    now: () => new Date("2026-10-11T10:00:00Z"),
  });
  return { logger, lines };
}

describe("logger", () => {
  it("writes one JSON line per event with timestamp, level and event", () => {
    const { logger, lines } = capture();
    logger.info("questionnaire.saved", { accountId: "acc_1", step: 3 });
    expect(lines).toEqual([
      {
        level: "info",
        record: {
          ts: "2026-10-11T10:00:00.000Z",
          level: "info",
          event: "questionnaire.saved",
          accountId: "acc_1",
          step: 3,
        },
      },
    ]);
  });

  it("redacts fields before they are serialised", () => {
    const { logger, lines } = capture();
    logger.error("stripe.webhook.failed", {
      email: "x@y.com",
      signature: "t=1,v1=abc",
      notes: "participant said",
      token: "sk_live_abcdefghijklmnop",
    });
    expect(lines[0].record).toMatchObject({
      email: EMAIL_MASK,
      signature: REDACTED,
      notes: OMITTED,
      token: REDACTED,
    });
  });

  it("drops events below the minimum level", () => {
    const lines: string[] = [];
    const logger = createLogger({
      sink: (_l, line) => lines.push(line),
      minLevel: "warn",
    });
    logger.info("ignored");
    logger.warn("kept");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('"event":"kept"');
  });

  it("error ids are short, url-safe and unique", () => {
    const a = newErrorId();
    const b = newErrorId();
    expect(a).toMatch(/^[a-f0-9]{12}$/);
    expect(a).not.toBe(b);
  });
});
