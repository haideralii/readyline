// @vitest-environment node
/**
 * REQ-008 AC-2, AC-4 and FR-1 over the product owner's copy in
 * product/legal/*.md: front matter, no prohibited claims, no hand-typed
 * heading numbers, no links off the site, and a readability warning (never a
 * failure) above each page's target grade. Warnings print as GitHub Actions
 * annotations so they show on the pull request.
 */
import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import { readability } from "@/lib/text/readability";
import { contactEmail } from "./config";
import {
  hasHandTypedNumbers,
  LEGAL_SLUGS,
  loadLegalPage,
  markdownToText,
  withoutQuotedMentions,
  type LegalSlug,
} from "./pages";

/** FR-1: grade 9 or below for the refund and AI pages, 11 for the rest. */
const TARGET: Record<LegalSlug, number> = {
  refunds: 9,
  ai: 9,
  terms: 11,
  privacy: 11,
  about: 11,
};

function warn(file: string, message: string) {
  console.warn(`::warning file=${file}::${message}`);
}

describe("product/legal copy (REQ-008)", () => {
  for (const slug of LEGAL_SLUGS) {
    const file = `product/legal/${slug}.md`;

    it(`${file}: front matter carries updated and owner po (AC-4)`, () => {
      const page = loadLegalPage(slug);
      expect(page.owner).toBe("po");
      expect(page.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(page.title.length).toBeGreaterThan(0);
      expect(page.title, "NDIS must not be in a page title").not.toMatch(
        /ndis/i,
      );
    });

    it(`${file}: no prohibited claims outside quoted mentions (AC-2)`, () => {
      const page = loadLegalPage(slug);
      expect(findProhibitedClaims(withoutQuotedMentions(page.body))).toEqual(
        [],
      );
    });

    it(`${file}: headings are numbered by the renderer, not the copy (D-043)`, () => {
      expect(hasHandTypedNumbers(loadLegalPage(slug).body)).toBe(false);
    });

    it(`${file}: links stay on the site`, () => {
      const page = loadLegalPage(slug);
      expect(page.body.match(/\]\((?:https?:)?\/\/[^)]*\)/g) ?? []).toEqual([]);
    });

    it(`${file}: readability is reported (warning above grade ${TARGET[slug]}, FR-1)`, () => {
      const page = loadLegalPage(slug);
      const score = readability(markdownToText(page.body));
      expect(score.words).toBeGreaterThan(50);
      console.info(
        `${file}: readability grade ${score.grade} (target ${TARGET[slug]}; ${score.words} words, ${score.sentences} sentences)`,
      );
      if (score.grade > TARGET[slug]) {
        warn(
          file,
          `readability grade ${score.grade} is above the target ${TARGET[slug]} for this page (${score.words} words, ${score.sentences} sentences)`,
        );
      }
    });
  }

  // REQ-022 Session E, FR-14 and AC-9 (D-2250 to D-2264): every sentence the
  // PO fixed after the lawyer role's read is present verbatim on its page, and
  // the pages' updated dates moved to the session's day.
  const FIXED: Record<LegalSlug, string[]> = {
    terms: [
      "If you need advice about your specific situation, speak to a lawyer.",
      "When the payment goes through, access resumes and the paused period is covered by it.",
      "While access is paused, your account export, including your worker records, stays available.",
      "A suspended account keeps its export, and you can email us to have the decision looked at again.",
      "If you do not accept a change, you can cancel before it takes effect and nothing further is charged.",
      "Nothing in these terms limits rights you have under the Australian Consumer Law; where a consumer guarantee applies, your remedies are the ones that law gives. For any other claim, and where the law allows, our liability to you is limited to the amount you paid Readyline in the 12 months before the claim. We are not liable for loss that comes from documents you did not review or adopt, or from information you entered that was not true.",
      // REQ-030 FR-7, D-2877 (the NDIS expert's read): record keeping is the provider's.
      "Your registers and exports are yours to keep; download them and keep them with your own files for as long as the NDIS rules require, because Readyline is not your record-keeping system and a restore from our backup can lose up to a week of entries.",
      // REQ-029 FR-13 (D-2858): the share sentence names what the auditor link now carries.
      "you share your records and the name, role and contact details on your account with whoever you send it to, exactly as you typed them",
    ],
    refunds: [
      "We want you to be happy with what you buy. If you are not, tell us and we will put it right or refund you as set out below.",
    ],
    privacy: [
      "Its servers are in Sydney where we can choose, and otherwise in the United States.",
      "Stripe may process data in the United States and elsewhere under its own privacy policy.",
      "train its models under its commercial terms, as read on {{vendor-terms-date}}.",
      "If you are a worker whose provider uses Readyline: your worker home shows what we hold about you, except your provider's own notes. Ask us by email for anything else; we answer within a reasonable period, and if we refuse we say why in writing.",
      "we tell you, and the Office of the Australian Information Commissioner where the law requires it.",
      "Readyline has not registered a choice to be covered by the Privacy Act; what this page promises is our own undertaking to you, and the Australian Consumer Law holds us to it.",
      "The owner decides and tells you the outcome in writing.",
      // REQ-030 FR-7, D-2872, D-2875, D-2873: the backup copy, the error reports, the retention line; `updated` does not move (D-2870).
      "GitHub, in the United States, keeps a weekly encrypted copy of our database for up to 90 days; only the owner holds the key that opens it, and each copy is deleted after 90 days.",
      "Sentry receives reports of errors on our servers, with email addresses and free text removed before they leave Australia, and stores them in the United States.",
      "An encrypted backup copy may still hold your data for up to 90 days after that, then it is deleted.",
      // REQ-031 D-2886 (AC-7), verbatim.
      "If you ask us to email you your result, we send it once to the address you type and do not keep the address. We keep a one-way code of it in our security log so we can see a send happened.",
      // REQ-029 FR-13 (D-2858), verbatim.
      "Your name, your role and the phone number or email address you give us for your documents. We put them into every document you download, into your audit pack and into the auditor link you share, and we keep them while your account is open.",
      // REQ-033 SR-1, D-2938: the findings bullet; the uploaded report is never kept (D-2930).
      "Audit findings you type or paste, in your own words, with the standard, the severity and the dates you record. A report you upload is read in Sydney to pick out its findings and is not kept, logged or sent to a model. Your findings are in your account export and are deleted with your account.",
    ],
    ai: [
      "train its models under its commercial terms, as read on {{vendor-terms-date}}.",
      "so it sits with your privacy commitments, where an auditor would look for it.",
      // REQ-033 D-2937: a finding's own words may reach the model, after the participant check; the report never does.
      "If you ask us to suggest which Practice Standard an audit finding sits under, we send the model that finding's words as you typed them, after they pass our participant check. The report you uploaded is never sent.",
    ],
    about: [
      "Readyline tells you which audit type and standards the Rules point to for your answers",
    ],
  };
  const GONE: Partial<Record<LegalSlug, string[]>> = {
    terms: ["or a qualified consultant"],
    privacy: [
      "handled elsewhere briefly",
      // REQ-030 D-2873: the old line named a schedule nobody had written.
      "Backups are deleted on their normal schedule after that.",
      "we tell you and the regulator as the law requires",
    ],
    ai: ["so an auditor finds it with your privacy commitments"],
    about: ["works out your audit type"],
  };

  for (const slug of LEGAL_SLUGS) {
    it(`product/legal/${slug}.md: carries the second draft's sentences verbatim and none of the old ones (FR-14, AC-9)`, () => {
      const page = loadLegalPage(slug);
      for (const sentence of FIXED[slug])
        expect(page.body, sentence).toContain(sentence);
      for (const old of GONE[slug] ?? [])
        expect(page.body, old).not.toContain(old);
      expect(page.updated, "updated moved to the session's day").toBe(
        UPDATED[slug],
      );
    });
  }

  // REQ-023 Session B (finding 38): the reminders sentence widens to the
  // subscription's reminders, which the provider can turn off, and the
  // privacy page's updated date moves with it; the other pages keep Session E's day.
  // REQ-029 FR-13 (D-2858): the two sentences moved terms and privacy to 18 October 2026.
  // REQ-033 D-2937: the model sentence moved the AI page to 18 October 2026.
  const UPDATED: Record<LegalSlug, string> = {
    terms: "2026-10-18",
    refunds: "2026-10-16",
    privacy: "2026-10-18",
    ai: "2026-10-18",
    about: "2026-10-16",
  };
  it("product/legal/privacy.md: the reminders sentence is the subscription's, which can be turned off (REQ-023 finding 38)", () => {
    const page = loadLegalPage("privacy");
    expect(page.body).toContain(
      "reminders that come with your subscription, which you can turn off",
    );
    expect(page.body).not.toContain("reminders you have asked for");
  });

  it("warns when CONTACT_EMAIL is not set (the footer then has no Contact link)", () => {
    if (!contactEmail()) {
      warn(
        ".env.example",
        "CONTACT_EMAIL is not set; the footer shows no Contact link and the legal pages point to a contact address that is not there yet",
      );
    }
    expect(true).toBe(true);
  });
});
