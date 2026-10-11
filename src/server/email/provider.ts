import "server-only";
/**
 * Transactional email behind one small interface (REQ-004 FR-6; D-013: the
 * provider is not chosen yet). Until it is, the only implementation logs that
 * a message would have been sent, with the recipient hashed, so the code paths
 * that send confirmations are exercised without any delivery.
 */
import { createHash } from "node:crypto";
import { log } from "@/lib/logging/logger";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

/** Records messages without sending them; used in tests and until D-013 is resolved. */
export class LogOnlyEmailProvider implements EmailProvider {
  readonly name = "log-only";
  readonly sent: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
    log.info("email.not-sent", {
      provider: this.name,
      recipientHash: createHash("sha256")
        .update(message.to.trim().toLowerCase(), "utf8")
        .digest("hex"),
      subject: message.subject,
    });
  }
}

/**
 * Picks the provider from the environment. A real provider arrives with D-013;
 * until then every environment logs only, and the variables EMAIL_FROM and
 * EMAIL_PROVIDER_API_KEY in .env.example stay unused.
 */
export function createEmailProvider(): EmailProvider {
  return new LogOnlyEmailProvider();
}
