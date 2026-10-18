// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("server-only", () => ({}));
// D-2837: the transport's options are read from nodemailer's factory, so the timeouts are asserted, not assumed.
const createTransport = vi.fn((options: unknown) => ({
  sendMail: vi.fn(),
  options,
}));
vi.mock("nodemailer", () => ({
  default: { createTransport: (o: unknown) => createTransport(o) },
}));
import {
  configuredEmailProvider,
  createEmailProvider,
  LogOnlyEmailProvider,
  readSmtpConfig,
  smtpMissing,
  SMTP_NAMES,
} from "./provider";

const complete = {
  EMAIL_PROVIDER: "smtp",
  SMTP_HOST: "smtp.example.test",
  SMTP_PORT: "465",
  SMTP_USER: "user",
  SMTP_PASS: "pass",
  EMAIL_FROM: "Readyline <no-reply@readyline.example>",
  HASH_PEPPER: "pepper",
  CONTACT_EMAIL: "hello@readyline.example",
};

function fakeTransport() {
  const sent: Record<string, unknown>[] = [];
  return {
    sent,
    transport: {
      sendMail: async (m: Record<string, unknown>) => {
        sent.push(m);
        return { messageId: "x" };
      },
    } as unknown as import("nodemailer").Transporter,
  };
}

describe("createEmailProvider (REQ-022 FR-5, D-2821)", () => {
  it("is the log-only provider when EMAIL_PROVIDER is unset or log", () => {
    expect(createEmailProvider({}).name).toBe("log-only");
    expect(createEmailProvider({ EMAIL_PROVIDER: "log" }).name).toBe(
      "log-only",
    );
    expect(configuredEmailProvider({})).toBe("log");
    expect(configuredEmailProvider({ EMAIL_PROVIDER: "ses" })).toBe("unknown");
  });

  it("is the SMTP provider when smtp is named and the six names are set", () => {
    const p = createEmailProvider(complete, {
      audit: null,
      transport: fakeTransport().transport,
    });
    expect(p.name).toBe("smtp");
    expect(smtpMissing(complete)).toEqual([]);
    expect(readSmtpConfig(complete)).toMatchObject({
      host: "smtp.example.test",
      port: 465,
      replyTo: "hello@readyline.example",
    });
  });

  for (const name of SMTP_NAMES) {
    it(`falls back to log-only and names ${name} when it is missing`, () => {
      const env = { ...complete, [name]: "" };
      expect(smtpMissing(env)).toEqual([name]);
      expect(createEmailProvider(env, { audit: null }).name).toBe("log-only");
    });
  }

  it("treats a port that is not a number as missing", () => {
    expect(smtpMissing({ ...complete, SMTP_PORT: "lots" })).toEqual([
      "SMTP_PORT",
    ]);
  });

  it("sends from EMAIL_FROM with CONTACT_EMAIL as the reply-to, both parts, and audits the template and the hash only", async () => {
    const t = fakeTransport();
    const audits: Record<string, unknown>[] = [];
    const p = createEmailProvider(complete, {
      transport: t.transport,
      audit: async (e) => {
        audits.push(e);
      },
    });
    await p.send({
      to: "Owner@Example.test",
      subject: "Readyline: a register reminder",
      text: "Reminders for Sunrise:\n\n- Policy review PR-1\n\nSign in at https://readyline.example/registers.",
      template: "reminders",
      accountId: "acc-1",
    });
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0]).toMatchObject({
      from: complete.EMAIL_FROM,
      to: "Owner@Example.test",
      replyTo: complete.CONTACT_EMAIL,
    });
    expect(String(t.sent[0].html)).toContain("<li>Policy review PR-1</li>");
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      template: "reminders",
      accountId: "acc-1",
    });
    const hash = String(audits[0].recipientHash);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(audits[0])).not.toMatch(
      /example\.test|Reminders for/,
    );
  });

  it("the log-only provider keeps the message and sends nothing", async () => {
    const p = new LogOnlyEmailProvider();
    await p.send({ to: "a@example.test", subject: "s", text: "t" });
    expect(p.sent).toHaveLength(1);
  });
});

describe("the log provider's test-only outbox (QA live b340ee3, batch C (3))", () => {
  it("appends one JSON line per message when EMAIL_OUTBOX_FILE is set, and writes nothing without it", async () => {
    const file = join(
      tmpdir(),
      `readyline-outbox-${process.pid}-${Date.now()}.ndjson`,
    );
    const before = process.env.EMAIL_OUTBOX_FILE;
    try {
      delete process.env.EMAIL_OUTBOX_FILE;
      const quiet = new LogOnlyEmailProvider();
      await quiet.send({ to: "a@example.test", subject: "s", text: "t" });
      expect(existsSync(file)).toBe(false);
      process.env.EMAIL_OUTBOX_FILE = file;
      const loud = new LogOnlyEmailProvider();
      await loud.send({
        to: "b@example.test",
        subject: "Readyline: a register reminder",
        text: "Reminders for X:\n\n- one",
        template: "reminders",
        accountId: "acc-1",
      });
      await loud.send({ to: "c@example.test", subject: "s2", text: "t2" });
      const lines = readFileSync(file, "utf8").trim().split("\n");
      expect(lines).toHaveLength(2);
      const first = JSON.parse(lines[0]) as Record<string, unknown>;
      expect(first).toMatchObject({
        to: "b@example.test",
        subject: "Readyline: a register reminder",
        template: "reminders",
        accountId: "acc-1",
      });
      expect(typeof first.at).toBe("string");
    } finally {
      if (before === undefined) delete process.env.EMAIL_OUTBOX_FILE;
      else process.env.EMAIL_OUTBOX_FILE = before;
      rmSync(file, { force: true });
    }
  });
});

describe("the SMTP transport's timeouts (D-2837)", () => {
  it("connects and greets within 10 s and gives a socket 30 s, so a hung host never holds the job", async () => {
    const { SMTP_TIMEOUTS, SmtpEmailProvider } = await import("./provider");
    createTransport.mockClear();
    new SmtpEmailProvider(
      {
        host: "smtp.example.test",
        port: 587,
        user: "u",
        pass: "p",
        from: "Readyline <no-reply@readyline.example>",
        replyTo: null,
      },
      null,
    );
    expect(createTransport).toHaveBeenCalledTimes(1);
    const options = createTransport.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(options).toMatchObject({
      host: "smtp.example.test",
      port: 587,
      secure: false,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    });
    expect(SMTP_TIMEOUTS.socketTimeout).toBeGreaterThan(
      SMTP_TIMEOUTS.connectionTimeout,
    );
  });
});
