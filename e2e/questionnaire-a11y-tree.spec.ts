import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

/**
 * REQ-013 FR-2 / AC-2 (both projects): every radio and checkbox in the
 * questionnaire has its human label as its accessible name (never a value
 * or a class code) and sits inside a fieldset with a non-empty legend. With
 * EVIDENCE=1 the per-step results are written to
 * product/evidence/req-013/accessibility-tree.json.
 */
type ControlRecord = {
  step: string;
  id: string;
  type: string;
  value: string;
  name: string;
  legend: string;
};

async function auditControls(
  page: Page,
  step: string,
): Promise<ControlRecord[]> {
  const records = await page.evaluate((stepName) => {
    const out: {
      step: string;
      id: string;
      type: string;
      value: string;
      name: string;
      legend: string;
    }[] = [];
    const controls = document.querySelectorAll<HTMLInputElement>(
      'input[type="radio"], input[type="checkbox"]',
    );
    for (const el of controls) {
      const labelledBy = el.getAttribute("aria-labelledby");
      const name = labelledBy
        ? labelledBy
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
            .join(" ")
            .trim()
        : (el.labels?.[0]?.textContent?.trim() ?? "");
      const fieldset = el.closest("fieldset");
      const legend =
        fieldset?.querySelector("legend")?.textContent?.trim() ?? "";
      out.push({
        step: stepName,
        id: el.id,
        type: el.type,
        value: el.value,
        name,
        legend,
      });
    }
    return out;
  }, step);
  for (const r of records) {
    expect(r.name, `${r.step} ${r.id}: accessible name`).not.toBe("");
    expect(
      r.name,
      `${r.step} ${r.id}: name must not be the raw value`,
    ).not.toBe(r.value);
    expect(
      r.name,
      `${r.step} ${r.id}: name must not start with a class code`,
    ).not.toMatch(/^\d{4}\b/);
    expect(r.legend, `${r.step} ${r.id}: legend`).not.toBe("");
  }
  // Cross-check a sample through Playwright's own accessible-name computation.
  const first = records[0];
  if (first) {
    await expect(page.locator(`[id="${first.id}"]`)).toHaveAccessibleName(
      first.name,
    );
  }
  return records;
}

test("every radio and checkbox has its human label as its accessible name and a legend (AC-2)", async ({
  page,
}, testInfo) => {
  const all: ControlRecord[] = [];
  await page.goto("/start/business");
  all.push(...(await auditControls(page, "business")));
  await page.getByLabel("Trading name").fill("Sunrise Supports");
  await page.getByRole("radio", { name: "Sole trader" }).check();
  await page.getByRole("checkbox", { name: "NSW" }).check();
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "The supports you deliver" }),
  ).toBeVisible();
  await page.locator("#group-0138").check();
  await expect(page.locator("#group-0107")).toHaveAccessibleName(
    "Assistance with daily personal activities",
  );
  all.push(...(await auditControls(page, "supports")));
  await page.locator("#group-0138").uncheck();
  await page.locator("#group-0107").check();
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Restrictive practices" }),
  ).toBeVisible();
  await page.locator("#restrictivePractices-not-sure").check();
  all.push(...(await auditControls(page, "practices")));
  await expect(
    page.locator("#restrictivePractices-not-sure"),
  ).toHaveAccessibleName("Not sure");

  await page.goto("/start/workforce").catch(() => undefined);
  await page.locator("#restrictivePractices-no").check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Your workforce" }),
  ).toBeVisible();
  all.push(...(await auditControls(page, "workforce")));
  await page.getByLabel("Number of workers").fill("2");
  await page.getByLabel("Number of key personnel").fill("1");
  await page.locator("#hasRiskAssessedRoles-yes").check();
  await page.locator("#allRiskAssessedScreened-yes").check();
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "What you already have" }),
  ).toBeVisible();
  all.push(...(await auditControls(page, "existing")));

  expect(all.length).toBeGreaterThan(50);
  testInfo.annotations.push({
    type: "controls-audited",
    description: String(all.length),
  });
  if (process.env.EVIDENCE) {
    mkdirSync("product/evidence/req-013", { recursive: true });
    writeFileSync(
      `product/evidence/req-013/accessibility-tree-${testInfo.project.name}.json`,
      JSON.stringify(
        { project: testInfo.project.name, controls: all.length, records: all },
        null,
        2,
      ),
    );
  }
});
