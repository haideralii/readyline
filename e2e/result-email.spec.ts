import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { findProhibitedClaims } from "@/lib/claims";
import {
  RESULT_EMAIL_FIRST_LINE,
  RESULT_SCOPE_SENTENCE,
  REGISTERS_SAMPLED_SENTENCE,
} from "@/lib/questionnaire/result-text";
import { openResultSections } from "./helpers/result";
import { reachResult } from "./helpers/questionnaire";

/**
 * REQ-031 FR-1 (AC-1, AC-3's hour sentence; D-2891, D-2893, D-2894): "Email
 * me my result" on the signed-out result, read back from the log provider's
 * outbox (EMAIL_OUTBOX_FILE, set by the e2e web server), one JSON line a
 * message. Desktop and Android; no Supabase needed (the limiter falls back
 * to the instance's memory where there is no database).
 */
const OUTBOX = ".e2e-outbox.ndjson";
const FORBIDDEN = /price|\$|buy|today|hurry|limited|offer/i;

type Captured = {
  to: string;
  subject: string;
  text: string;
  template?: string;
};

function captured(to: string): Captured[] {
  if (!existsSync(OUTBOX)) return [];
  return readFileSync(OUTBOX, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Captured)
    .filter((m) => m.to === to);
}

async function texts(page: Page, selector: string): Promise<string[]> {
  return (await page.locator(selector).allTextContents()).map((s) =>
    s.replace(/\s+/g, " ").trim(),
  );
}

test.describe("REQ-031: email me my result", () => {
  test("AC-1: the form under the card sends the result once, and the message is the result and nothing else", async ({
    page,
    baseURL,
  }) => {
    await reachResult(page);
    await expect(page.getByTestId("result")).toBeVisible();
    const form = page.getByTestId("result-email-form");
    await expect(form.getByText("Email me my result")).toBeVisible();
    const field = page.getByTestId("result-email");
    await expect(field).toHaveAttribute("type", "email");
    await expect(field).toHaveAttribute("autocomplete", "email");
    await expect(field).toHaveValue("");
    // D-2891: the privacy line under the field, with its link.
    const privacy = page.getByTestId("result-email-privacy");
    await expect(privacy).toContainText(
      "We send your result to this address once and do not keep the address.",
    );
    await expect(
      privacy.getByRole("link", { name: "Privacy policy" }),
    ).toHaveAttribute("href", "/privacy");

    // What the screen shows, for the message to match.
    await openResultSections(page);
    const card = page.getByTestId("summary");
    const heading =
      (await card.getByRole("heading", { level: 2 }).textContent()) ?? "";
    const kind = heading.match(/Your audit: (\w+)/)?.[1] ?? "";
    const groups = await texts(
      page,
      '[data-testid="summary"] ul[aria-label] li',
    );
    const counts = await Promise.all(
      ["summary-documents", "summary-registers", "checklist-count-line"].map(
        async (id) => ((await page.getByTestId(id).textContent()) ?? "").trim(),
      ),
    );
    const modules = (
      await texts(page, '[data-testid^="module-"] > p:first-child')
    ).map((s) => s.replace(/\s*\(\d+ standards\)$/, ""));
    const reasons = page.getByTestId("reason");
    const reasonCount = await reasons.count();
    const sourceTitles: string[] = [];
    for (let i = 0; i < reasonCount; i += 1) {
      const link = (await reasons.nth(i).getByRole("link").textContent()) ?? "";
      sourceTitles.push(
        link.replace(/\s*\(opens in a new tab\)\s*$/, "").trim(),
      );
    }

    const address = `result-${randomUUID()}@example.test`;
    await field.fill(address);
    await page.getByTestId("result-email-send").click();
    const reply = page.getByTestId("result-email-message");
    // The server derives and sends; a dev server compiles the action first.
    await expect(reply).toHaveText(`Sent to ${address}`, { timeout: 30_000 });

    const sent = captured(address);
    expect(sent).toHaveLength(1);
    const m = sent[0];
    expect(m.template).toBe("result");
    expect(m.subject).toBe(`Readyline: your result, a ${kind} audit`);
    expect(m.text.startsWith(RESULT_EMAIL_FIRST_LINE)).toBe(true);
    expect(m.text).toContain(`Your audit: ${kind}`);
    expect(m.text).toContain(RESULT_SCOPE_SENTENCE);
    for (const g of groups) {
      const name = g.replace(/\s+\d{4}$/, "");
      expect(m.text, g).toContain(name);
    }
    expect(m.text).toContain(counts[0]);
    expect(m.text).toContain(`${counts[1]}. ${REGISTERS_SAMPLED_SENTENCE}`);
    expect(m.text).toContain(counts[2]);
    for (const name of modules) expect(m.text, name).toContain(name);
    expect(sourceTitles.length).toBe(reasonCount);
    for (const title of sourceTitles)
      expect(m.text, title).toContain(`Source: ${title}.`);
    const origin = new URL(baseURL!).origin;
    for (const url of m.text.match(/https?:\/\/[^\s]+/g) ?? [])
      expect(url, url).toMatch(
        new RegExp(`^${origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(/|$)`),
      );
    expect(m.text).toContain(
      `Sign in to get ready: ${origin}/sign-in?next=/path/before-you-buy`,
    );
    expect(m.text).toContain(`Open your checklist: ${origin}/checklist`);
    expect(m.text).toContain(`start the questionnaire: ${origin}/start`);
    expect(m.text).toContain(
      "Readyline provides general information and document templates for your own review; it is not legal advice.",
    );
    expect(findProhibitedClaims(`${m.subject}\n${m.text}`)).toEqual([]);
    // The regex over the words; the on-site paths ("/path/before-you-buy") are the PO's own.
    expect(m.text.replace(/https?:\/\/\S+/g, "")).not.toMatch(FORBIDDEN);
    expect(m.subject).not.toMatch(FORBIDDEN);

    // AC-3: the same address within the hour is the hour sentence, and the outbox did not grow.
    await page.getByTestId("result-email-send").click();
    await expect(reply).toHaveText(
      "You already asked for this result in the last hour",
      { timeout: 30_000 },
    );
    expect(captured(address)).toHaveLength(1);
  });
});
