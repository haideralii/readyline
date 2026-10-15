import { test, expect } from "@playwright/test";
import { reachResult } from "./helpers/questionnaire";

/**
 * Batch 47 item 1, the off state: with no registers Price and fake mode off
 * (STRIPE_FAKE=0; CI's own step), every page that names the registers
 * subscription says the one off-state sentence and sells nothing, and no
 * page says "coming", "soon" or "when available". Production shows this
 * state until Haider sets STRIPE_PRICE_REGISTERS.
 */
const OFF =
  "The registers subscription is not switched on in this environment.";

test.describe("one subscription story, off (batch 47 item 1)", () => {
  test.skip(
    process.env.STRIPE_FAKE !== "0",
    "needs a server started with STRIPE_FAKE=0 and no Stripe values",
  );

  test("home, pricing, refunds and terms say the one sentence and sell nothing", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("home-subscription-off")).toContainText(OFF);
    await expect(page.getByTestId("home-subscription-line")).toHaveCount(0);

    await page.goto("/pricing");
    await expect(page.getByTestId("subscription-off")).toHaveText(OFF);
    await expect(page.getByTestId("subscription-offer")).toHaveCount(0);
    await expect(page.getByTestId("subscribe-button")).toHaveCount(0);
    await expect(page.getByRole("main")).not.toContainText(/coming|soon/i);

    await page.goto("/refunds");
    await expect(page.getByRole("main")).toContainText(OFF);
    await expect(page.getByRole("main")).not.toContainText(/when available/i);

    await page.goto("/terms");
    await expect(page.getByRole("main")).toContainText(OFF);
  });

  test("the result page says the one sentence where it would name the subscription", async ({
    page,
  }) => {
    await reachResult(page);
    await expect(page.getByTestId("result-subscription-off")).toContainText(
      OFF,
    );
    await expect(page.getByTestId("what-next")).toContainText(OFF);
    await expect(page.getByTestId("result-two-halves")).not.toContainText(
      "The subscription",
    );
  });
});
