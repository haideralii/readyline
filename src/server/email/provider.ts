import "server-only";
/**
 * Transactional email behind one small interface (REQ-004 FR-6; REQ-022
 * FR-5 under D-2822). Two implementations: the log-only provider, the
 * default everywhere, which records that a message would have been sent
 * with the recipient hashed; and the SMTP provider, plain SMTP through
 * nodemailer, chosen by EMAIL_PROVIDER=smtp with SMTP_HOST, SMTP_PORT,
 * SMTP_USER, SMTP_PASS and EMAIL_FROM set (and HASH_PEPPER, which the
 * unsubscribe token and the hashed audit lines hang off). No vendor code:
 * whichever sender Haider chooses on the launch day is those five values,
 * here and in Supabase's custom SMTP. Every real send is one audit-log line
 * with the template name and the hashed address, never the body.
 */
import { createHash } from "node:crypto";
import nodemailer, { type Transporter } from "nodemailer";
import { log } from "@/lib/logging/logger";
import { emailHash } from "@/lib/peppered-hash";
import { renderHtml } from "./html";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  /** The HTML alternative; rendered from the text by the provider when a template leaves it out (FR-7). */
  html?: string;
  /** The template's name, for the audit line (FR-5). */
  template?: string;
  /** The account the message is about, for the audit line; null for the admin's own test send. */
  accountId?: string | null;
};

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

/** Records messages without sending them; the default, and what tests and CI use. */
export class LogOnlyEmailProvider implements EmailProvider {
  readonly name = "log-only";
  readonly sent: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
    log.info("email.not-sent", {
      provider: this.name,
      template: message.template ?? "untitled",
      recipientHash: createHash("sha256")
        .update(message.to.trim().toLowerCase(), "utf8")
        .digest("hex"),
      subject: message.subject,
    });
  }
}

/** The five values the SMTP provider needs, plus the pepper (D-2822, SR-6). */
export const SMTP_NAMES = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "EMAIL_FROM",
  "HASH_PEPPER",
] as const;

export type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  replyTo: string | null;
};

type Source = Record<string, string | undefined>;

/** What EMAIL_PROVIDER names: `log` when unset, `smtp`, or `unknown` for any other word. */
export function configuredEmailProvider(
  source: Source = process.env,
): "log" | "smtp" | "unknown" {
  const v = source.EMAIL_PROVIDER?.trim().toLowerCase();
  if (!v || v === "log") return "log";
  return v === "smtp" ? "smtp" : "unknown";
}

/** The names the SMTP provider needs and does not have; a port that is not a number counts as missing. */
export function smtpMissing(source: Source = process.env): string[] {
  const missing: string[] = SMTP_NAMES.filter((n) => !source[n]?.trim());
  if (!missing.includes("SMTP_PORT")) {
    const port = Number(source.SMTP_PORT?.trim());
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      missing.push("SMTP_PORT");
  }
  return missing;
}

export function readSmtpConfig(
  source: Source = process.env,
): SmtpConfig | null {
  if (smtpMissing(source).length) return null;
  const replyTo = source.CONTACT_EMAIL?.trim();
  return {
    host: source.SMTP_HOST!.trim(),
    port: Number(source.SMTP_PORT!.trim()),
    user: source.SMTP_USER!.trim(),
    pass: source.SMTP_PASS!.trim(),
    from: source.EMAIL_FROM!.trim(),
    replyTo: replyTo ? replyTo : null,
  };
}

/** Writes the one audit line a real send leaves (FR-5): the template and the hashed address, never the body. */
export type SendAudit = (entry: {
  template: string;
  recipientHash: string;
  accountId: string | null;
}) => Promise<void>;

export class SmtpEmailProvider implements EmailProvider {
  readonly name = "smtp";
  private readonly transport: Transporter;
  constructor(
    private readonly config: SmtpConfig,
    private readonly audit: SendAudit | null,
    transport?: Transporter,
  ) {
    this.transport =
      transport ??
      nodemailer.createTransport({
        host: config.host,
        port: config.port,
        // TLS from the first byte on 465 (SMTPS); STARTTLS on the others.
        secure: config.port === 465,
        auth: { user: config.user, pass: config.pass },
      });
  }
  async send(message: EmailMessage): Promise<void> {
    const template = message.template ?? "untitled";
    const recipientHash = emailHash(message.to);
    await this.transport.sendMail({
      from: this.config.from,
      to: message.to,
      replyTo: this.config.replyTo ?? undefined,
      subject: message.subject,
      text: message.text,
      html: message.html ?? renderHtml(message.text),
    });
    log.info("email.sent", { provider: this.name, template, recipientHash });
    if (this.audit)
      await this.audit({
        template,
        recipientHash,
        accountId: message.accountId ?? null,
      });
  }
}

let warnedMisconfigured = false;

/** The audit line through the service role, outside any request's session. */
const defaultAudit: SendAudit = async (entry) => {
  const { createSupabaseAdminClient } = await import("@/server/supabase/admin");
  const r = await createSupabaseAdminClient()
    .from("audit_log")
    .insert({
      account_id: entry.accountId,
      actor_user_id: null,
      action: "email.sent",
      target: `${entry.template}:${entry.recipientHash}`,
    });
  if (r.error)
    log.warn("audit.write.failed", {
      action: "email.sent",
      code: r.error.code,
    });
};

/**
 * Picks the provider from the environment. `log` (or nothing) is the
 * log-only provider; `smtp` with every name set is the SMTP provider;
 * `smtp` with a name missing logs the names once and falls back to the
 * log-only provider, so a reminder is recorded rather than lost silently
 * and the launch row reads it as mismatched (REQ-022 FR-1).
 */
export function createEmailProvider(
  source: Source = process.env,
  options: { audit?: SendAudit | null; transport?: Transporter } = {},
): EmailProvider {
  const configured = configuredEmailProvider(source);
  if (configured === "log") return new LogOnlyEmailProvider();
  const missing = configured === "smtp" ? smtpMissing(source) : [];
  const config = configured === "smtp" ? readSmtpConfig(source) : null;
  if (!config) {
    if (!warnedMisconfigured) {
      warnedMisconfigured = true;
      log.warn("email.smtp.misconfigured", {
        configured: source.EMAIL_PROVIDER?.trim() ?? "",
        missing,
        note: "email logs only until the names are set (REQ-022 FR-5, D-2822)",
      });
    }
    return new LogOnlyEmailProvider();
  }
  return new SmtpEmailProvider(
    config,
    options.audit === undefined ? defaultAudit : options.audit,
    options.transport,
  );
}
