import { test, expect } from "@playwright/test";
import { reachResult } from "./helpers/questionnaire";

/**
 * Batch 47 item 1, the on state: with the registers Price configured (every
 * e2e run, through fake mode) the home page, the result page, the pricing
 * page and the refunds page all sell the subscription, and none of them
 * carries the off-state sentence or a "when available". The off state is
 * subscription-off.spec.ts, run with STRIPE_FAKE=0 and no Stripe values.
 */
const OFF =
  "The registers subscription is not switched on in this environment.";

test.describe("one subscription story, on (batch 47 item 1)", () => {
  test.skip(
    process.env.STRIPE_FAKE === "0",
    "the on state needs fake mode or a registers Price",
  );

  test("home, pricing and refunds sell the subscription in one voice", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("home-subscription-line")).toBeVisible();
    await expect(page.getByTestId("home-subscription-off")).toHaveCount(0);

    await page.goto("/pricing");
    await expect(page.getByTestId("subscription-offer")).toBeVisible();
    await expect(page.getByTestId("subscription-off")).toHaveCount(0);

    await page.goto("/refunds");
    const article = page.getByRole("main");
    await expect(article).toContainText("The registers subscription");
    await expect(article).not.toContainText(/when available/i);
    await expect(article).not.toContainText(OFF);

    await page.goto("/terms");
    await expect(page.getByRole("main")).not.toContainText(/when available/i);
  });

  test("the result page names the subscription as what keeps your evidence current", async ({
    page,
  }) => {
    await reachResult(page);
    await expect(page.getByTestId("result-two-halves")).toContainText(
      "The subscription",
    );
    await expect(page.getByTestId("result-subscription-off")).toHaveCount(0);
    await expect(page.getByTestId("what-next")).toContainText(
      "the registers follow as a subscription",
    );
  });
});
