import { test, expect } from "@playwright/test";
import { gotoSettled } from "./helpers/a11y";
import { keyboardPass } from "./helpers/keyboard-pass";

/**
 * REQ-012 FR-3b (AC-8), the public half: the questionnaire's intro and its
 * first two steps walked with the keyboard alone. Every focusable element is
 * reached by Tab in document order, every stop shows a visible focus ring,
 * nothing traps focus, and each disclosure met on the way opens with Enter
 * and closes again (an overlay would have to close on Escape). The
 * signed-in half (the account page, every register list and form, the
 * worker home) is e2e/signed-in/launch-review-keyboard.spec.ts; REQ-015's
 * pass still fills the whole questionnaire by keyboard.
 */
const PAGES = ["/start", "/start/business", "/start/supports", "/sign-in"];

test.describe("launch review: the keyboard pass on the questionnaire (REQ-012 FR-3b, AC-8)", () => {
  test.describe.configure({ timeout: 300_000 });

  for (const path of PAGES) {
    test(`${path}: every control reached by Tab in order with a visible ring; disclosures open and close`, async ({
      page,
    }, testInfo) => {
      await gotoSettled(page, path);
      // The step forms are inert until hydrated (D-1012); wait for a live control.
      await page
        .waitForFunction(
          () => !document.querySelector("fieldset:disabled"),
          undefined,
          { timeout: 15_000 },
        )
        .catch(() => undefined);
      const pass = await keyboardPass(page, path);
      await testInfo.attach(`keyboard-${path.replace(/\W+/g, "-")}.txt`, {
        body: [
          `stops: ${pass.trail.length}; toggled: ${pass.toggled.length}; missed: ${pass.missed.length}`,
          ...pass.trail,
          "",
          ...pass.toggled.map((t) => `toggled: ${t}`),
          ...pass.missed.map((m) => `missed: ${m}`),
        ].join("\n"),
        contentType: "text/plain",
      });
      expect(
        pass.trail.length,
        `${path}: the walk reached the page's controls`,
      ).toBeGreaterThan(2);
      for (const m of pass.missed) console.log(`${path}: missed ${m}`);
      expect(
        pass.missed,
        `${path}: focusable elements Tab never reached`,
      ).toEqual([]);
    });
  }
});
