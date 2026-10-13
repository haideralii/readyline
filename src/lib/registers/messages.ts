/**
 * The database's refusals as plain words (REQ-009 SR-1, PO answer 4): a
 * lapsed subscription, a CHECK that caught an NDIS-number shape or an
 * inconsistent value, a duplicate. Never the raw message.
 */
export const LAPSE_MESSAGE =
  "Your subscription has lapsed; your records are safe and read-only. Renew to add to them.";

export function plainDatabaseMessage(error: {
  code?: string;
  message?: string;
}): string {
  if (error.code === "42501") return LAPSE_MESSAGE;
  if (error.code === "23514") {
    if (/ndis_number|looks_like/.test(error.message ?? ""))
      return "That text looks like an NDIS participant number. Use a reference code instead.";
    return "One of the values is not allowed. Check the dates and codes and try again.";
  }
  if (error.code === "23505") return "That entry already exists.";
  return "We could not save that just now. Try again.";
}
