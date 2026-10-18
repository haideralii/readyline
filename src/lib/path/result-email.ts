/**
 * The result email's limits and keys (REQ-031 FR-1, SR-2, SR-3; D-2883;
 * question 2 (a)): one send per address per rolling hour, five per IP, the
 * address bucket hit first so a limited address never spends the IP's; the
 * keys carry peppered hashes, never the address or the raw IP. Pure.
 */
export const RESULT_EMAIL_LIMITS = {
  perAddress: { limit: 1, windowSeconds: 3600 },
  perIp: { limit: 5, windowSeconds: 3600 },
} as const;

export function resultEmailAddressKey(emailHashed: string): string {
  return `result-email:${emailHashed}`;
}

export function resultEmailIpKey(ipHashed: string): string {
  return `result-email-ip:${ipHashed}`;
}
