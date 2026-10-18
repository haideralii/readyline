import type { TestInfo } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  generateAuditorToken,
  hashAuditorToken,
} from "@/lib/registers/auditor-link";
import { createTenant, deleteTenant, type TestTenant } from "./session";

/**
 * REQ-012 FR-3 (SR-2): the throwaway tenants the launch review's signed-in
 * specs share: a subscribed owner with a staff row and a pending check, a
 * worker member of that account, a live auditor link, an invitation and a
 * report link, all seeded directly through the service role (D-2340's rule
 * for a worker session). One set per spec and project; deleted afterwards.
 */
export type LaunchReviewTenants = {
  owner: TestTenant;
  worker: TestTenant;
  auditorToken: string;
  inviteToken: string;
  reportToken: string;
};

const answers = () =>
  JSON.parse(
    readFileSync(
      "fixtures/reference-cases/verification-sole-trader.json",
      "utf8",
    ),
  ) as Record<string, unknown>;

export async function createLaunchReviewTenants(
  testInfo: TestInfo,
  tag: string,
): Promise<LaunchReviewTenants> {
  const owner = await createTenant({
    label: `lr-${tag}-owner-${testInfo.project.name}`,
    tradingName: "Sunrise Supports",
    answers: answers(),
  });
  const fail = (what: string, error: { message: string } | null) => {
    if (error) throw new Error(`${what}: ${error.message}`);
  };
  fail(
    "entitlement",
    (
      await owner.admin
        .from("entitlements")
        .insert({ account_id: owner.accountId, kind: "subscription" })
    ).error,
  );
  fail(
    "staff row",
    (
      await owner.admin.from("staff_matrix").insert({
        account_id: owner.accountId,
        worker_ref: "W-003",
        role_label: "support worker",
        role: "support-worker",
        states: ["NSW"],
        risk_assessed: true,
        risk_paragraph: "a",
      })
    ).error,
  );
  const worker = await createTenant({
    label: `lr-${tag}-worker-${testInfo.project.name}`,
    tradingName: "",
    answers: {},
    withAccount: false,
  });
  fail(
    "worker membership",
    (
      await owner.admin.from("memberships").insert({
        user_id: worker.userId,
        account_id: owner.accountId,
        role: "worker",
        worker_ref: "W-003",
      })
    ).error,
  );
  const auditorToken = generateAuditorToken();
  fail(
    "auditor link",
    (
      await owner.admin.from("auditor_links").insert({
        account_id: owner.accountId,
        token_hash: hashAuditorToken(auditorToken),
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      })
    ).error,
  );
  const inviteToken = `inv-${randomUUID()}`;
  fail(
    "invitation",
    (
      await owner.admin.from("invitations").insert({
        account_id: owner.accountId,
        email_hash: "a".repeat(64),
        worker_ref: "W-004",
        token_hash: hashAuditorToken(inviteToken),
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      })
    ).error,
  );
  const reportToken = `rep-${randomUUID()}`;
  fail(
    "report link",
    (
      await owner.admin.from("report_links").insert({
        account_id: owner.accountId,
        token_hash: hashAuditorToken(reportToken),
      })
    ).error,
  );
  return { owner, worker, auditorToken, inviteToken, reportToken };
}

export async function deleteLaunchReviewTenants(
  t: LaunchReviewTenants | undefined,
) {
  if (!t) return;
  await deleteTenant(t.worker);
  await deleteTenant(t.owner);
}

/** The signed-in routes the review walks, by role. */
export const REGISTERS = [
  "incidents",
  "complaints",
  "worker-checks",
  "policy-reviews",
  "staff-matrix",
  "onboarding",
  "hazards",
  "improvements",
  "insurances",
  "participant-risks",
  "corporate-risks",
  "decisions",
  "delegations",
  "conflicts-of-interest",
  "commission-changes",
] as const;

export const OWNER_PAGES = [
  "/checklist",
  "/documents",
  "/account",
  "/registers",
  "/registers/staff",
  "/registers/document-control",
  ...REGISTERS.flatMap((r) => [`/registers/${r}`, `/registers/${r}/new`]),
  "/path/before-you-buy",
  "/path/audit-day",
  "/path/renewal",
  "/path/renewal/application",
];

export const WORKER_PAGES = [
  "/worker",
  "/worker/incidents/new",
  "/worker/complaints/new",
];
