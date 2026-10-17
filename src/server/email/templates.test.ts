import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import { renderHtml } from "./html";
import {
  remindersEmail,
  reportToConfirmEmail,
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
