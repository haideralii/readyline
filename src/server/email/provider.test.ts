// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
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
