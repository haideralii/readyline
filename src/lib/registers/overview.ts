/**
 * The registers as one line for the account page (REQ-009 batch 28 item
 * 4): current entries on the ready line's "done" fill, due-soon or
 * expiring on "to prepare", overdue or expired or unacknowledged on the
 * remainder, and a sentence that says the numbers in words. Pure, so the
 * wording is unit-tested.
 */
export type RegisterOverview = {
  incidents: { total: number; open: number; overdueNotification: number };
  complaints: { total: number; unresolved: number };
  workerChecks: { total: number; expiring: number; expired: number };
  policyReviews: {
    total: number;
    dueSoon: number;
    overdue: number;
    notAdopted: number;
  };
};

export function registersLine(o: RegisterOverview): {
  current: number;
  dueSoon: number;
  overdue: number;
  sentence: string;
} {
  const overdue =
    o.incidents.overdueNotification +
    o.workerChecks.expired +
    o.policyReviews.overdue;
  const dueSoon =
    o.workerChecks.expiring + o.policyReviews.dueSoon + o.complaints.unresolved;
  const total =
    o.incidents.total +
    o.complaints.total +
    o.workerChecks.total +
    o.policyReviews.total;
  const current = Math.max(total - dueSoon - overdue, 0);
  const parts: string[] = [];
  if (o.incidents.overdueNotification)
    parts.push(
      `${o.incidents.overdueNotification} incident${o.incidents.overdueNotification === 1 ? "" : "s"} overdue to notify the Commission`,
    );
  if (o.workerChecks.expired)
    parts.push(
      `${o.workerChecks.expired} worker check${o.workerChecks.expired === 1 ? "" : "s"} expired`,
    );
  if (o.policyReviews.overdue)
    parts.push(
      `${o.policyReviews.overdue} policy review${o.policyReviews.overdue === 1 ? "" : "s"} overdue`,
    );
  if (o.workerChecks.expiring)
    parts.push(
      `${o.workerChecks.expiring} worker check${o.workerChecks.expiring === 1 ? "" : "s"} expiring soon`,
    );
  if (o.policyReviews.dueSoon)
    parts.push(
      `${o.policyReviews.dueSoon} policy review${o.policyReviews.dueSoon === 1 ? "" : "s"} due soon`,
    );
  if (o.complaints.unresolved)
    parts.push(
      `${o.complaints.unresolved} complaint${o.complaints.unresolved === 1 ? "" : "s"} unresolved`,
    );
  const sentence =
    total === 0
      ? "No register entries yet."
      : parts.length === 0
        ? `${total} ${total === 1 ? "entry" : "entries"}, all current.`
        : `${parts.join(", ")}.`;
  return { current, dueSoon, overdue, sentence };
}
