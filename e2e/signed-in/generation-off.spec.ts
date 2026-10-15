import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { hasSupabaseForE2e } from "../helpers/env";
import {
  createTenant,
  deleteTenant,
  signInContext,
  type TestTenant,
} from "../helpers/session";

/**
 * Batch 45 item 2 (PO decision, 15 Oct 2026, run 38661716805): with
 * `GENERATION_ENABLED` unset, a signed-in owner who has bought nothing sees
 * no Buy box on /documents, only the one line that says generation is off
 * and points at the result. The page needs a session, so this is a signed-in
 * spec; CI's Supabase job runs it in its own step with the variable unset,
 * and the main signed-in step (which sets it to true) skips it.
 */
const enabled = hasSupabaseForE2e();
const generationOn =
  process.env.GENERATION_ENABLED?.trim().toLowerCase() === "true";
const answers = JSON.parse(
  readFileSync(
    "fixtures/reference-cases/verification-sole-trader.json",
    "utf8",
  ),
) as Record<string, unknown>;

test.describe("the documents page with generation off (batch 45 item 2)", () => {
  test.skip(!enabled, "needs the Supabase variables");
  test.skip(generationOn, "GENERATION_ENABLED is true in this run");

  let tenant: TestTenant;

  test.beforeAll(async ({}, testInfo) => {
    tenant = await createTenant({
      label: `generation-off-${testInfo.project.name}`,
      tradingName: "Sunrise Supports",
      answers,
    });
  });

  test.afterAll(async () => {
    if (tenant) await deleteTenant(tenant);
  });

  test("no Buy box, one line that says generation is off, and a link to the result", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInContext(context, tenant, baseURL!);
    await page.goto("/documents");
    const line = page.getByTestId("generation-disabled");
    await expect(line).toBeVisible();
    await expect(line).toContainText(
      "Document generation is not switched on in this environment.",
    );
    await expect(
      line.getByRole("link", { name: "See your result" }),
    ).toBeVisible();
    await expect(page.getByTestId("purchase-none")).toHaveCount(0);
    await expect(page.getByTestId("buy-button")).toHaveCount(0);
    await expect(page.getByText(/coming soon/i)).toHaveCount(0);
  });
});
