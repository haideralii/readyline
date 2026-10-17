/**
 * REQ-022 FR-6 as D-2824 reads it for plain SMTP: the provider reports no
 * domain state, so the launch row "Sending domain records" reads the
 * sender's DNS instead: an SPF TXT record on the domain and a DMARC TXT
 * record at `_dmarc.<domain>`. DKIM's selector belongs to the sender and
 * is a runbook line. These are the pure parts: the domain out of
 * EMAIL_FROM, the two record tests, and the row's judgement from what the
 * server's lookup found (null where the lookup failed or timed out: one
 * "not verified here" row, never a thrown page).
 */
export type DnsFacts = {
  /** True when a TXT record on the domain starts with `v=spf1`; null when the lookup failed. */
  spf: boolean | null;
  /** True when a TXT record at `_dmarc.<domain>` starts with `v=DMARC1`; null when the lookup failed. */
  dmarc: boolean | null;
};

/** The domain of `Readyline <no-reply@readyline.example>` or `no-reply@readyline.example`; null when there is none. */
export function senderDomain(from: string | undefined): string | null {
  const v = from?.trim();
  if (!v) return null;
  const m =
    /<([^<>@\s]+)@([^<>@\s]+)>\s*$/.exec(v) ??
    /^([^<>@\s]+)@([^<>@\s]+)$/.exec(v);
  const domain = m?.[2]?.toLowerCase().replace(/\.$/, "");
  return domain && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) ? domain : null;
}

/** A TXT answer is a list of records, each a list of string chunks. */
export function hasSpf(records: readonly (readonly string[])[]): boolean {
  return records.some((r) => /^v=spf1(\s|$)/i.test(r.join("").trim()));
}

export function hasDmarc(records: readonly (readonly string[])[]): boolean {
  return records.some((r) => /^v=DMARC1(\s*;|$)/i.test(r.join("").trim()));
}

export function judgeSenderDomain(
  from: string | undefined,
  dns: DnsFacts | null,
): {
  state: "set" | "unset" | "mismatched" | "unverified";
  sentence: string;
} {
  if (!senderDomain(from))
    return {
      state: "unverified",
      sentence:
        "Set EMAIL_FROM to a sender on your domain; then this row reads the domain's SPF and DMARC records.",
    };
  if (!dns || dns.spf === null || dns.dmarc === null)
    return {
      state: "unverified",
      sentence:
        "The DNS lookup did not answer in time; reload, and check the SPF and DMARC records in LAUNCH.md at the registrar.",
    };
  const missing = [
    ...(dns.spf ? [] : ["SPF"]),
    ...(dns.dmarc ? [] : ["DMARC"]),
  ];
  return missing.length
    ? {
        state: "mismatched",
        sentence: `The sender's domain has no ${missing.join(" or ")} record; add the records in LAUNCH.md at the registrar (DKIM is the sender's selector, a runbook line).`,
      }
    : {
        state: "set",
        sentence:
          "The sender's domain carries SPF and DMARC records (DKIM is checked at the sender).",
      };
}
