import { test, expect } from "@playwright/test";
import { hasSupabaseForE2e } from "../helpers/env";
import { checkWidths } from "../helpers/width";
import {
  createTenant,
  deleteTenant,
  signInContext,
  type TestTenant,
} from "../helpers/session";

/**
 * Batch 45 item 28: a new customer creates the account through the setup
 * form exactly as a customer would (a fresh user, the form, "Create my
 * account", then the start of the guided path), on all three projects, in
 * CI's Supabase job. The other signed-in specs seed their tenant through the
 * `create_account` RPC and never submit this form, which is how a client-side
 * validation failure on every save (#34, run 38591057870) went unseen: from
 * batch 37 up no new customer could have created an account. Rule (DoD 11):
 * every form a customer submits has one e2e that submits it through the
 * real handler.
 */
const enabled = hasSupabaseForE2e();

test.describe("a new customer creates the account through the setup form (batch 45 item 28)", () => {
  test.skip(!enabled, "needs the Supabase variables");

  let user: TestTenant;

  test.beforeAll(async ({}, testInfo) => {
    user = await createTenant({
      label: `setup-${testInfo.project.name}`,
      tradingName: "",
      answers: {},
      withAccount: false,
    });
  });

  test.afterAll(async () => {
    if (user) await deleteTenant(user);
  });

  test("the setup form creates the account, the path starts at the questionnaire, and the account page shows what was typed", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInContext(context, user, baseURL!);
    await page.goto("/account/setup");
    await expect(
      page.getByRole("heading", { name: "About your business" }),
    ).toBeVisible();
    await checkWidths(page, "account setup");

    await page.locator("#tradingName").fill("Sunrise Supports");
    await page.locator("#structure-sole-trader").check();
    await page.locator("#states-NSW").check();
    await page.locator("#ownerName").fill("Jane Citizen");
    await page.locator("#ownerRole").fill("Owner");
    // The button enables on hydration (147ccad); a click then runs the action.
    const create = page.getByRole("button", { name: "Create my account" });
    await expect(create).toBeEnabled();
    await create.click();

    // No draft on this device, so the guided path starts at the questionnaire.
    await expect(page).toHaveURL(/\/start(\/|$)/, { timeout: 30_000 });

    // The account exists with what was typed, owner facts included (D-1704).
    await page.goto("/account");
    await expect(page.getByText("Sunrise Supports").first()).toBeVisible();
    await expect(page.locator("#tradingName")).toHaveValue("Sunrise Supports");
    await expect(page.locator("#structure-sole-trader")).toBeChecked();
    await expect(page.locator("#states-NSW")).toBeChecked();
    await expect(page.locator("#ownerName")).toHaveValue("Jane Citizen");
    await expect(page.locator("#ownerRole")).toHaveValue("Owner");

    // A second visit to the setup page lands on the account: never a second account.
    await page.goto("/account/setup");
    await expect(page).toHaveURL(/\/account$/);
  });
});
