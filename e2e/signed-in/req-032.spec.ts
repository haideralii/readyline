import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { hasSupabaseForE2e } from "../helpers/env";
import {
  createTenant,
  deleteTenant,
  signInContext,
  type TestTenant,
} from "../helpers/session";

/**
 * REQ-032 AC-1 (FR-2, FR-4, FR-5; D-2916, D-2921): an unauthorised
 * restrictive practice that caused no harm, recorded on Thursday 2 April
 * 2026 by an NSW account, reads notify by 13 April 2026 with "Good Friday
 * and Easter Monday do not count"; a {NSW, WA} account reads the same
 * (both days are national); a {NSW, VIC} account recorded on Friday 30
 * October 2026 reads Friday 6 November (Melbourne Cup Day is Victoria's
 * alone), where a VIC account reads Monday 9 November with the day named.
 * The form's preview says the same before the save. Needs a Supabase stack.
 */
const enabled = hasSupabaseForE2e();
const answers = JSON.parse(
  readFileSync(
    "fixtures/reference-cases/verification-sole-trader.json",
    "utf8",
  ),
) as Record<string, unknown>;

type Case = {
  label: string;
  states: string[];
  occurred: string;
  notifyBy: string;
  bracket: string | null;
};
const CASES: Case[] = [
  {
    label: "nsw",
    states: ["NSW"],
    occurred: "2026-04-02",
    notifyBy: "2026-04-13",
    bracket: "(Good Friday and Easter Monday do not count)",
  },
  {
    label: "nsw-wa",
    states: ["NSW", "WA"],
    occurred: "2026-04-02",
    notifyBy: "2026-04-13",
    bracket: "(Good Friday and Easter Monday do not count)",
  },
  {
    label: "nsw-vic",
    states: ["NSW", "VIC"],
    occurred: "2026-10-30",
    notifyBy: "2026-11-06",
    bracket: null,
  },
  {
    label: "vic",
    states: ["VIC"],
    occurred: "2026-10-30",
    notifyBy: "2026-11-09",
    bracket: "(Melbourne Cup Day does not count)",
  },
];

async function recordAndRead(page: Page, c: Case) {
  await page.goto("/registers/incidents/new");
  await page.getByLabel("Date it happened").fill(c.occurred);
  await page.getByLabel("Date you became aware").fill(c.occurred);
  await page.getByLabel("Date it was reported").fill(c.occurred);
  await page
    .getByLabel("What happened", { exact: true })
    .selectOption("restrictive-practice-unauthorised");
  await page.getByLabel("How serious").selectOption("low");
  await page.getByLabel(/Participant code/).fill("P-001");
  await page
    .getByLabel(/What happened, in a sentence/)
    .fill("A door was locked for a time.");
  await page.getByLabel("Reportable to the Commission").check();
  const words = `${c.notifyBy}${c.bracket ? ` ${c.bracket}` : ""}`;
  // The preview before the save says the same as the row will.
  await expect(page.getByTestId("notify-by")).toContainText(words);
  await page.getByTestId("register-submit").click();
  await expect(page.getByTestId("register-saved")).toBeVisible();
  // The row's fact, whatever today's date makes of its status.
  await expect(page.getByTestId("incident-facts")).toContainText(
    `Notify the Commission by ${words}`,
  );
  if (c.bracket === null) {
    await expect(page.getByTestId("incident-facts")).not.toContainText(
      "do not count",
    );
    await expect(page.getByTestId("incident-facts")).not.toContainText(
      "does not count",
    );
  }
}

test.describe("public holidays in the business-day count (REQ-032 AC-1)", () => {
  test.skip(!enabled, "needs the Supabase variables");
  test.describe.configure({ timeout: 180_000 });

  for (const c of CASES) {
    test(`${c.label}: recorded ${c.occurred} reads notify by ${c.notifyBy}${c.bracket ? " with the holidays named" : ""}`, async ({
      page,
      context,
      baseURL,
    }, testInfo) => {
      let tenant: TestTenant | null = null;
      try {
        tenant = await createTenant({
          label: `req-032-${c.label}-${testInfo.project.name}`,
          tradingName: "Holiday Supports",
          answers,
          states: c.states,
        });
        const ent = await tenant.admin
          .from("entitlements")
          .insert({ account_id: tenant.accountId, kind: "subscription" });
        if (ent.error) throw ent.error;
        await signInContext(context, tenant, baseURL!);
        await recordAndRead(page, c);
        // The database agrees with the screen.
        const row = await tenant.admin
          .from("incidents")
          .select("notify_by")
          .eq("account_id", tenant.accountId)
          .single();
        expect(row.data?.notify_by).toBe(c.notifyBy);
      } finally {
        if (tenant) await deleteTenant(tenant);
      }
    });
  }
});
