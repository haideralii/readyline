import type { TestTenant } from "./session";
import { addDays, todaySydney } from "./dates";

/**
 * REQ-028 FR-8 (AC-6, D-2815): rows seeded through the admin client, as
 * REQ-009's fixture is, for the register tables. Dates follow the runner's
 * Sydney day (D-2272); the reference is the trigger's. One name is planted
 * in every narrative field so the spec can assert it reaches no cell.
 */
export const PLANTED_NAME = "Jordan Example";

const CATEGORIES = [
  "near-miss",
  "medication",
  "property-or-environment",
  "other",
] as const;

/** `count` incidents, the newest first by occurred_on; the first carries the planted name. */
export async function seedIncidents(
  tenant: TestTenant,
  count: number,
): Promise<{ newestOccurredOn: string }> {
  const today = todaySydney();
  const rows = Array.from({ length: count }, (_, i) => {
    const occurred = addDays(today, -(i + 1));
    return {
      account_id: tenant.accountId,
      occurred_on: occurred,
      reported_on: occurred,
      category: CATEGORIES[i % CATEGORIES.length],
      severity: "low",
      participant_ref: `P-${String((i % 7) + 1).padStart(3, "0")}`,
      summary:
        i === 0
          ? `${PLANTED_NAME} slipped on the back step.`
          : `Row ${i + 1}: a slip on the back step.`,
      actions_taken:
        i === 0 ? `Spoke with ${PLANTED_NAME} and dried the step.` : "",
      reportable: false,
      status: "open",
    };
  });
  const r = await tenant.admin.from("incidents").insert(rows);
  if (r.error) throw r.error;
  return { newestOccurredOn: addDays(today, -1) };
}

export async function seedComplaint(tenant: TestTenant): Promise<void> {
  const today = todaySydney();
  const r = await tenant.admin.from("complaints").insert({
    account_id: tenant.accountId,
    received_on: addDays(today, -2),
    channel: "phone",
    from_ref: "FAM-1",
    summary: `${PLANTED_NAME} called about a late shift.`,
    outcome: `Apologised to ${PLANTED_NAME}.`,
    status: "received",
  });
  if (r.error) throw r.error;
}

export async function seedCorporateRisk(tenant: TestTenant): Promise<void> {
  const today = todaySydney();
  const r = await tenant.admin.from("corporate_risks").insert({
    account_id: tenant.accountId,
    area: "people-and-staffing",
    what_could_happen: `${PLANTED_NAME} leaves at short notice.`,
    likelihood: "medium",
    controls: `A second worker knows ${PLANTED_NAME}'s roster.`,
    owner_role: "Owner",
    review_on: addDays(today, 60),
  });
  if (r.error) throw r.error;
}
