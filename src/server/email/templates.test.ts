import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import { deriveChecklist } from "@/lib/checklist/derive";
import { loadReferenceCases } from "@/lib/generator/reference-cases";
import { glossarySentence } from "@/lib/questionnaire/content";
import { buildResult } from "@/lib/questionnaire/result";
import {
  REGISTERS_SAMPLED_SENTENCE,
  RESULT_EMAIL_FIRST_LINE,
  RESULT_SCOPE_SENTENCE,
} from "@/lib/questionnaire/result-text";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { renderHtml } from "./html";
import {
  remindersEmail,
  reportToConfirmEmail,
  resultEmail,
  workerInvitationEmail,
} from "./templates";
import {
  accountDeletedEmail,
  accountPurgedEmail,
  documentsReadyEmail,
  formatDateAu,
} from "./templates";

describe("account emails (REQ-004 FR-6)", () => {
  const deleted = accountDeletedEmail({
    to: "owner@example.test",
    tradingName: "Sunrise Supports",
    deletedAt: new Date("2026-10-11T03:00:00Z"),
    purgeAfter: new Date("2026-11-10T03:00:00Z"),
  });
  const purged = accountPurgedEmail({
    to: "owner@example.test",
    tradingName: "Sunrise Supports",
    purgedAt: new Date("2026-11-11T03:00:00Z"),
  });

  it("names the business and both dates in Australian format", () => {
    expect(deleted.text).toContain("Sunrise Supports");
    expect(deleted.text).toContain("11 October 2026");
    expect(deleted.text).toContain("10 November 2026");
    expect(purged.text).toContain("11 November 2026");
  });

  it("carries the general-information line and no prohibited claim", () => {
    for (const m of [deleted, purged]) {
      expect(m.text).toMatch(/not legal advice/);
      expect(findProhibitedClaims(`${m.subject}\n${m.text}`)).toEqual([]);
    }
  });

  it("formats dates in the Sydney time zone", () => {
    expect(formatDateAu(new Date("2026-12-31T14:30:00Z"))).toBe(
      "1 January 2027",
    );
  });
});

describe("documents-ready email (REQ-007 FR-5)", () => {
  const ready = documentsReadyEmail({
    to: "owner@example.test",
    tradingName: "Sunrise Supports",
    documentsUrl: "https://readyline.example/documents",
  });

  it("names the business, links the documents page and keeps the review wording", () => {
    expect(ready.subject).toMatch(/documents are ready/);
    expect(ready.text).toContain("Sunrise Supports");
    expect(ready.text).toContain("https://readyline.example/documents");
    expect(ready.text).toMatch(/first draft for your review/);
    expect(ready.text).toMatch(/not legal advice/);
    expect(findProhibitedClaims(`${ready.subject}\n${ready.text}`)).toEqual([]);
  });
});

describe("the invitation's first steps (REQ-024 FR-9, AC-8)", () => {
  const m = workerInvitationEmail({
    to: "worker@example.test",
    tradingName: "Sunrise Supports",
    workerRef: "W-3",
    url: "https://readyline.example/invite/abc",
    expiresOn: "1 November 2026",
  });
  it("carries the three steps in the worker's words, the link and the FR-7 subject, and no number but the code and the date", () => {
    expect(m.subject).toContain(
      "log incidents and complaints and complete your onboarding",
    );
    expect(m.text).toContain("Code of Conduct acknowledgement");
    expect(m.text).toContain("NDIS Worker Orientation Module");
    expect(m.text).toContain(
      "incident, complaints, privacy and safeguarding policies",
    );
    expect(m.text).toContain("https://readyline.example/invite/abc");
    // No phone, check or application number: nothing of five digits or more.
    expect(m.text).not.toMatch(/\d{5,}/);
    expect(findProhibitedClaims(m.text)).toEqual([]);
  });
});

/** REQ-031 FR-1: the sole-trader fixture's result as the page derives it. */
function resultMessage(input: { signedIn: boolean; contact?: string | null }) {
  const dataset = getStandardsDataset();
  const c = loadReferenceCases()[0];
  const outcome = buildResult(dataset, c.answers);
  if (!outcome.ok) throw new Error(outcome.message);
  return resultEmail({
    to: "someone@example.test",
    result: outcome.result,
    checklistTotal: deriveChecklist(outcome.result, c.answers, dataset).total,
    signedIn: input.signedIn,
    origin: "https://readyline.example",
    today: new Date("2026-10-18T03:00:00Z"),
    contact:
      input.contact === undefined ? "hello@readyline.example" : input.contact,
  });
}

describe("the result email (REQ-031 FR-1; D-2884, D-2885, D-2893 to D-2895, D-2897)", () => {
  const m = resultMessage({ signedIn: false });
  it("names the audit kind in the subject, opens with D-2894's line, and carries the result in FR-1's order", () => {
    expect(m.template).toBe("result");
    expect(m.subject).toBe("Readyline: your result, a verification audit");
    const lines = m.text.split("\n");
    expect(lines[0]).toBe(RESULT_EMAIL_FIRST_LINE);
    expect(lines[2]).toBe("Your audit: verification");
    expect(lines[3]).toBe(glossarySentence("verification-audit"));
    expect(lines[4]).toBe(RESULT_SCOPE_SENTENCE);
    const order = [
      "Registration groups in scope:",
      "Documents: ",
      "Registers: ",
      REGISTERS_SAMPLED_SENTENCE,
      "Checklist: ",
      "Practice Standards modules that apply:",
      "Mid-term audit: ",
      "Why this result:",
      "Sign in to get ready: https://readyline.example/sign-in?next=/path/before-you-buy",
      "Open your checklist: https://readyline.example/checklist",
      "Your result is not saved on our side. To see it again, start the questionnaire: https://readyline.example/start",
      "Prepared by Readyline from your answers on 18 October 2026",
      "general information",
      "Readyline. Contact: hello@readyline.example",
    ];
    let at = -1;
    for (const needle of order) {
      const i = m.text.indexOf(needle, at + 1);
      expect(i, needle).toBeGreaterThan(at);
      at = i;
    }
  });
  it("names every group with its code, every module with its standards count, and every reason with its source's short name and no URL", () => {
    const dataset = getStandardsDataset();
    const c = loadReferenceCases()[0];
    const r = buildResult(dataset, c.answers);
    if (!r.ok) throw new Error("fixture");
    for (const g of r.result.groups)
      expect(m.text).toContain(`- ${g.name} (${g.code})`);
    for (const mod of r.result.modules)
      expect(m.text).toContain(`- ${mod.name} (${mod.standardCount} `);
    for (const x of r.result.reasons) {
      expect(m.text).toContain(`- ${x.text} Source: ${x.source.title}.`);
      expect(m.text).not.toContain(x.source.url);
    }
    for (const url of m.text.match(/https?:\/\/[^\s]+/g) ?? [])
      expect(url).toMatch(/^https:\/\/readyline\.example(\/|$)/);
  });
  it("carries no price, offer or urgency, no claim, and no glossary line but the audit kind's (question 1 (a))", () => {
    // AC-1's regex runs over the words; the on-site links are D-2893's own paths
    // ("/path/before-you-buy" carries "buy"), so they are taken out first.
    const words = m.text.replace(/https?:\/\/\S+/g, "");
    expect(words).not.toMatch(/price|\$|buy|today|hurry|limited|offer/i);
    expect(m.subject).not.toMatch(/price|\$|buy|today|hurry|limited|offer/i);
    expect(findProhibitedClaims(`${m.subject}\n${m.text}`)).toEqual([]);
    expect(m.text).not.toContain("What these words mean");
    expect(
      m.text
        .split("\n")
        .filter((l) => l === glossarySentence("verification-audit")),
    ).toHaveLength(1);
  });
  it("signed in, the next step and the link back are the owner's, and without a contact address the footer names the business alone", () => {
    const signedIn = resultMessage({ signedIn: true, contact: null });
    expect(signedIn.text).toContain(
      "Go to your next step: https://readyline.example/path/before-you-buy",
    );
    expect(signedIn.text).toContain(
      "See your result: https://readyline.example/start/result",
    );
    expect(signedIn.text).not.toContain("Sign in to get ready");
    expect(signedIn.text).not.toContain("not saved on our side");
    expect(signedIn.text.trimEnd().endsWith("\nReadyline")).toBe(true);
    expect(signedIn.text).not.toContain("Contact:");
  });
});

describe("every template as the provider sends it (REQ-022 FR-5, FR-7)", () => {
  const origin = "https://readyline.example";
  const all = [
    accountDeletedEmail({
      to: "owner@example.test",
      tradingName: "Sunrise Supports",
      deletedAt: new Date("2026-10-11T03:00:00Z"),
      purgeAfter: new Date("2026-11-10T03:00:00Z"),
    }),
    accountPurgedEmail({
      to: "owner@example.test",
      tradingName: "Sunrise Supports",
      purgedAt: new Date("2026-11-11T03:00:00Z"),
    }),
    documentsReadyEmail({
      to: "owner@example.test",
      tradingName: "Sunrise Supports",
      documentsUrl: `${origin}/documents`,
    }),
    workerInvitationEmail({
      to: "worker@example.test",
      tradingName: "Sunrise Supports",
      workerRef: "W-1",
      url: `${origin}/invite/abc`,
      expiresOn: "1 November 2026",
    }),
    reportToConfirmEmail({
      to: "owner@example.test",
      tradingName: "Sunrise Supports",
      count: 1,
    }),
    resultMessage({ signedIn: false }),
    remindersEmail({
      to: "owner@example.test",
      tradingName: "Sunrise Supports",
      lines: ["Policy review PR-1 is due on 1 November 2026"],
      unsubscribeUrl: `${origin}/email/unsubscribe/abc`,
    }),
  ];

  it("names its template and carries the general-information line", () => {
    for (const m of all) {
      expect(m.template, m.subject).toMatch(/^[a-z-]+$/);
      expect(m.text, m.subject).toMatch(/general information/);
    }
  });

  it("renders an HTML alternative with no image, no style and no off-site link", () => {
    for (const m of all) {
      const html = renderHtml(m.text, origin);
      expect(html, m.subject).not.toMatch(/<img|<style|<script|style=/);
      for (const href of html.matchAll(/href="([^"]+)"/g))
        expect(href[1], m.subject).toMatch(new RegExp(`^${origin}(/|$)`));
      expect(findProhibitedClaims(html), m.subject).toEqual([]);
    }
  });

  it("the reminders carry the unsubscribe line when given a link; nothing else does", () => {
    const withLink = all[all.length - 1];
    expect(withLink.text).toContain(
      "To stop these reminder emails: https://readyline.example/email/unsubscribe/abc",
    );
    for (const m of all.slice(0, -1))
      expect(m.text, m.subject).not.toMatch(/unsubscribe|stop these/i);
    const without = remindersEmail({
      to: "owner@example.test",
      tradingName: "Sunrise Supports",
      lines: ["one"],
    });
    expect(without.text).not.toMatch(/stop these/);
  });
});
