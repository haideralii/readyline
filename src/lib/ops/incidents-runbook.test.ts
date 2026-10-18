import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { redactString } from "@/lib/logging/redact";

/**
 * REQ-030 FR-4, AC-10, SR-1 (D-2868): the incident runbook names every
 * production secret in its rotation section and no value, address or token
 * anywhere; the breach section carries Part IIIC's words; the restore
 * section ends with the purge and the owner email.
 */
const text = readFileSync("product/ops/INCIDENTS.md", "utf8");
const sections = new Map<string, string>();
for (const part of text.split(/^## /m).slice(1)) {
  const heading = part.split("\n")[0];
  sections.set(heading.split(".")[0].trim(), part);
}

/** The secret names section 3 must rotate, in the REQ's order (FR-4). */
const SECRETS = [
  "SUPABASE_SECRET_KEY",
  "SUPABASE_DB_PASSWORD",
  "CRON_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "ANTHROPIC_API_KEY",
  "SMTP_PASS",
  "GITHUB_DISPATCH_TOKEN",
  "SENTRY_DSN",
  "BACKUP_PASSPHRASE",
  "HASH_PEPPER",
];

describe("the incident runbook (REQ-030 FR-4, AC-10)", () => {
  it("has the eight sections in order", () => {
    expect([...sections.keys()]).toEqual([
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
    ]);
  });

  it("section 3 names every production secret, in the REQ's order, and the backup passphrase step deletes the retained artifacts", () => {
    const three = sections.get("3")!;
    let last = -1;
    for (const name of SECRETS) {
      const at = three.indexOf(name);
      expect(at, name).toBeGreaterThan(-1);
      expect(at, `${name} in order`).toBeGreaterThan(last);
      last = at;
    }
    expect(three).toMatch(/delete every retained backup artifact/);
    expect(three).toMatch(/HASH_PEPPER` only if it leaked/);
  });

  it("carries no value, address or token shape on any line (SR-1), and no name but Haider's", () => {
    for (const line of text.split("\n")) {
      expect(redactString(line), line).toBe(line);
    }
    expect(text).not.toMatch(/@/);
    expect(text).not.toMatch(/https?:\/\/(?!<domain>)/);
    expect(text).not.toMatch(/\b(Jane|John|Sunrise|Riverbend)\b/);
  });

  it("section 5 follows the Notifiable Data Breaches scheme in the REQ's words and says a breach here is not a reportable incident (D-2874, D-2878)", () => {
    const five = sections.get("5")!;
    expect(five).toContain("OAIC");
    expect(five).toContain("within 30 days");
    expect(five).toContain("as soon as practicable");
    expect(five).toMatch(/serious harm/);
    expect(five).toMatch(/not a reportable incident/);
    expect(five).toMatch(/worker/);
  });

  it("section 6 ends with the re-deletion through the purge and the owner email (FR-4)", () => {
    const six = sections.get("6")!;
    expect(six).toContain("/api/jobs/purge");
    expect(six).toMatch(/Email every owner the restore date/);
    expect(six).toMatch(/re-entered from their own records/);
  });
});
