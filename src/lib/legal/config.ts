import { BRAND } from "@/lib/brand";
/**
 * Footer contact details (REQ-008 FR-2). Both values are public once set, but
 * they are read on the server (the footer is a server component) so nothing
 * about them is inlined into the browser bundle. Read through functions, not
 * at module load, so tests can pass their own environment.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The address behind the Contact link, or null when `CONTACT_EMAIL` is unset or not an address. */
export function contactEmail(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const value = env.CONTACT_EMAIL?.trim();
  return value && EMAIL.test(value) ? value : null;
}

/** The registered business name, or null when `BUSINESS_NAME` is unset or blank (batch 45 item 1). */
export function businessName(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const value = env.BUSINESS_NAME?.trim();
  return value ? value : null;
}

/** The ABN formatted "NN NNN NNN NNN", or null when `BUSINESS_ABN` is unset or not 11 digits. */
export function businessAbn(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const digits = (env.BUSINESS_ABN ?? "").replace(/\s+/g, "");
  if (!/^\d{11}$/.test(digits)) return null;
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
}

/** REQ-034 FR-2 (D-2810's rule): the one-line business identity the footer and the trust page share: the brand, and the ABN once set. */
export function businessIdentityLine(
  env: Record<string, string | undefined> = process.env,
): string {
  const abn = businessAbn(env);
  return `${BRAND}${abn ? ` (ABN ${abn})` : ""}`;
}
