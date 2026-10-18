# Legal bundle index, 18 October 2026

Built by `scripts/ops/legal-bundle.mjs` on 18 October 2026 from the committed files and the public pages' addresses (REQ-022 FR-11). No PDF and no browser: a reader opens each URL and each committed file. No customer data of any kind: the pages are public and the document set is the committed fixture case. The model vendor's terms are quoted as read on the date shown. The privacy and AI pages' "as read on" date is this index's date. The pages are given as paths on the site; rebuild with `--base https://<domain>` for full addresses once the domain is live.

## Questions for the lawyer (FR-12)

The product owner's questions are in `product/legal/questions-for-the-lawyer.md` (last updated 16 October 2026), each with the lawyer role's read under it. The questions, in that file's order:

- 1. Business structure and the general-information disclaimer
  - 1.1 Readyline trades as a sole trader; does the ACL reach its pages at all, and in what capacity does it contract?
  - 1.2 Is "Readyline provides general information and document templates for your own review. It is not legal advice" (`src/lib/brand.ts:16-19`, `terms.md:18`) an adequate disclaimer, and what does it not do?
  - 1.3 Does anything on the pages amount to unqualified legal practice?
- 2. Refunds and the consumer guarantees
  - 2.1 Is a provider that buys the pack for its business a "consumer", so that the guarantees apply?
  - 2.2 Is the pack goods or services, and which guarantees attach?
  - 2.3 Does the refund page limit the buyer's rights, or read as if it does?
  - 2.4 Does "You can have a full refund within 14 days of buying the pack if you have not downloaded any of the documents" create a condition the ACL does not allow?
  - 2.5 Does `terms.md:50` "our liability to you is limited to the amount you paid Readyline in the 12 months before the claim" survive?
  - 2.6 Is the sentence "We are not liable for loss that comes from documents you did not review or adopt, or from information you entered that was not true" (`terms.md:50`) sound?
- 3. Subscription terms
  - 3.1 Pausing: `terms.md:30` "If a payment fails, access pauses until it is paid; nothing extra is charged" and `refunds.md:24` "If a payment fails, your access pauses; nothing is added to what you owe".
  - 3.2 Cancelling: "You can cancel at any time. You keep access until the end of the period you have paid for" (`refunds.md:24`, `terms.md:30`).
  - 3.3 "We may change features, prices for future purchases, and these terms. We give at least 30 days' notice of changes to prices or terms that affect a subscription" (`terms.md:46`).
  - 3.4 The paused-access sentence and the s 21 export carve-out (D-2415).
  - 3.5 "Documents you have already bought stay available for download for at least 12 months after purchase" (`terms.md:46`).
  - 3.6 "We may suspend an account that breaks these rules, and we will tell you why" (`terms.md:40`).
- 4. The AI disclosure
  - 4.1 "Anthropic does not use our requests to train its models" (`ai.md:22`, `privacy.md:42`).
  - 4.2 "Readyline does not give legal advice and does not guarantee that you will pass an audit or be registered" (`ai.md:34`, `terms.md:18`).
  - 4.3 "Software checks each tailored section ... It must avoid claims such as 'guaranteed' or 'audit-proof'" (`ai.md:26`).
  - 4.4 Is the AI disclosure on every surface CLAUDE.md 4.3 names (pricing page, download page, readiness summary's first page, zip cover note)?
- 5. The privacy policy against the APPs and the small-business threshold
  - 5.1 Is Readyline an APP entity?
  - 5.2 If Readyline is not an APP entity, what binds it?
  - 5.3 Overseas disclosure: the model provider and Stripe.
  - 5.4 Retention.
  - 5.5 Access and correction.
  - 5.6 The notifiable data breach sentence, `privacy.md:58` "If a breach happens that is likely to cause serious harm, we tell you and the regulator as the law requires".
  - 5.7 "If we find participant information, we may remove it and tell you" (`privacy.md:27`).
- 6. The worker role, the one-time fill, the records exemption and the owner's notes (REQ-024)
  - 6.1 Is the one-time fill (D-2408; FR-6b) a collection under APP 3 even though nothing is stored?
  - 6.2 Does the APP 5 notice reach the worker (D-2414; the printable notice)?
  - 6.3 The employee-records exemption, [PA] s 7B(3), for contractors and volunteers (SR-1(a), (e)).
  - 6.4 The APP 12 access path for a worker (SR-1(b), (f)) and the owner's notes.
  - 6.5 Is a worker's decision code (`excluded`, `revoked`, `interim-bar`) sensitive information?
- 7. The auditor link and the state screening Acts' secrecy provisions (SR-5, D-2446)
  - 7.1 May a provider pass a worker's check number and decision code to an approved quality auditor through the link and the pack, state by state? Read, as far as the texts reach: the secrecy provisions found bind the regulator and persons performing functions under the state Act, not a provider holding a number it got from the worker or the Commission's database. [Vic] s 130(1): "any information acquired by the person in the performance of functions or exercise of powers under this Act" (VERIFIED). [Qld] s 138ZLB(1): "a Minister or a member of the Minister's staff; or (ii) a public service employee employed in the department" (VERIFIED), and s 228(3) the department's own people and contractors (VERIFIED). [WA] s 71: "A person who is or has been engaged in the performance of functions under this Act" (VERIFIED), with (d) excepting a disclosure "otherwise connected with the operation of the National Disability Insurance Scheme". [Tas] s 54: "An officer", defined as the Registrar, an advisor or "any other person who is performing or exercising ... a function or power under this Act" (VERIFIED). [ACT] s 65(6): the commissioner, an advisor or "anyone else who has exercised a function under this Act" (VERIFIED). Each excepts disclosure with the person's consent. On the Commonwealth side, [WSR] s 18(3)(d) requires the provider to record "the worker's NDIS worker screening check number" and the outcome (VERIFIED) and s 20 requires the list "in a form which would allow an auditor to determine" who was engaged on any day (VERIFIED), so the Rules contemplate the auditor reading the numbers. [NSW] and [NT]: UNVERIFIED, not reached; [SA] s 29 (confidentiality) UNVERIFIED. Severity: for a practising lawyer, medium; the product's hedge ("for you to check against the Commission's database entry the provider shows you", D-2446) is sound meanwhile. Text change: none to the page; in REQ-024 SR-5, correct the citations "Worker Screening Act 2020 (Vic) Part 8" to s 130 and Chapter 7, and "NDIS (Worker Screening) Act 2020 (WA) Part 7" to ss 68 and 71 in Part 6, since Part 8 (Vic) is offences by bodies corporate and regulations and Part 7 (WA) is consequential amendments (both VERIFIED from the tables of provisions). Why still the lawyer: NSW and the NT are unread; whether a unit's outcome notice to an employer carries a condition of use under the information-sharing chapters (Vic Chapter 7 read by heading only); and the Privacy Act question in 6.5 for a provider that is an APP entity.
  - 7.2 Is the NSW instrument the one SR-5 names?
- 8. The Victorian pair, Worker Screening Rules s 25(5)(d)(iii) (SR-5, D-2439, D-2446)
  - 8.1 Can a Commonwealth condition-of-registration exception ([WSR] s 14(1)(b)(i), Part 4) be relied on where the Worker Screening Act 2020 (Vic) prohibits engaging in a risk assessed role without a clearance?
  - 8.2 Can anyone still satisfy s 25(5)(b) and (c)?
  - 8.3 For completeness across the states on pending work (the "with few exceptions" the product means): [WA] s 68(1)(b) allows work where "the person has applied ... the application is pending, and the person is not subject to an interim bar" (VERIFIED); [Tas] s 18 allows an "eligible person" to work under a "named employer" with "an approved risk management plan" (VERIFIED); [ACT] s 13(5) allows work "under section 15 or section 16" (VERIFIED; those sections unread); [Qld] s 54(1) "must not start, or continue, an engagement ... unless the person holds an NDIS clearance" and s 54(2) the same for "an NDIS sole trader" (VERIFIED, no allowance found); [SA] s 18F "nothing in this Part authorises an applicant ... to undertake NDIS work" (VERIFIED through the fetch tool); [Vic] as in 8.1; [NSW] and [NT] UNVERIFIED. Severity: no finding; recorded so the product's state lines rest on sections, not unit pages.
- 9. REQ-027's three questions and its one-line reads
  - 9.1 Nominative use of "NDIS Worker Screening Check" on a commercial site.
  - 9.2 The offer heading "What keeps you audit-ready" (`payments/copy.ts:58`, `home-copy.ts:25`) and the home sentence `home-copy.ts:29`, "$X a month keeps you audit-ready: the registers, the reminders and the mid-term audit countdown, with the evidence already in place at renewal. Cancel at any time."
  - 9.3 The inline attribution `title` on a one-term page (D-2719) and the footer's general-information statement.
  - 9.4 One-line reads of the typed sentences, as REQ-027 quotes them.

## The bundle, in order

1. **Terms of use.** /terms (source `product/legal/terms.md`). Last updated: 16 October 2026.
2. **Privacy policy.** /privacy (source `product/legal/privacy.md`). Last updated: 17 October 2026.
3. **Refunds.** /refunds (source `product/legal/refunds.md`). Last updated: 16 October 2026.
4. **How Readyline uses AI.** /ai (source `product/legal/ai.md`). Last updated: 16 October 2026.
5. **About Readyline.** /about (source `product/legal/about.md`). Last updated: 16 October 2026.
6. **The AI and digital tools appendix.** The provider's own statement on AI and digital tools, an unnumbered appendix to the privacy policy in every pack (REQ-016 S-6): fixed text in `src/lib/generator/fixed-extras.ts` (section `ai-and-digital-tools` in `data/readyline-content/document-types.json`), rendered in `product/evidence/req-005/sole-trader/privacy-and-information-management-policy.docx`. Last updated: 18 October 2026.
7. **Anthropic Commercial Terms of Service.** https://www.anthropic.com/legal/commercial-terms, the page states "Effective 17 June 2025"; read on 18 October 2026. This is the source for the privacy page's and the AI page's sentence that Anthropic does not use our requests to train its models. As read: Section B, "Customer Content": "Anthropic may not train models on Customer Content from Services." Last updated: 18 October 2026.
8. **The refund promise as it appears on /pricing and /documents.** /pricing (before purchase) and /documents (signed in, after purchase) read the "Our promise" and "The document pack" sections of `product/legal/refunds.md` at render time, so the three say the same thing. The paragraphs: Last updated: 16 October 2026.
   > We want you to be happy with what you buy. If you are not, tell us and we will put it right or refund you as set out below.
   > You can have a full refund within 14 days of buying the pack if you have not downloaded any of the documents.
   > If you have downloaded the documents, we still refund you if they do not match the answers you gave in the questionnaire, or if they are missing something you were told they would include. When we are not sure, we decide in your favour.
9. **The pricing page.** /pricing (source `src/app/pricing/page.tsx`, words in `src/lib/payments/copy.ts`). Last updated: 17 October 2026.
10. **The sign-in screen.** /sign-in (source `src/app/sign-in/sign-in-form.tsx`). Last updated: 18 October 2026.
11. **The account-setup screen.** /account/setup (signed in; source `src/app/account/account-form.tsx`). Last updated: 17 October 2026.
12. **The worker invitation and reminder email templates.** `src/server/email/templates.ts`, the templates named `worker-invitation` and `reminders`; every sentence is quoted and checked in `src/server/email/templates.test.ts`. Listed, not rendered: the index is built without a server or a model (D-2288). Last updated: 18 October 2026.
13. **One generated sole-trader document set.** `product/evidence/req-005/sole-trader/`, the committed REQ-005 reference case (16 `.docx` files, with `sections.md` saying which sections are model text and which are fixed): Last updated: 15 October 2026.
   Case: verification-sole-trader (Sunrise Supports, sole trader, New South Wales; classes 0120; verification).
   Rendered 2026-10-14 from recorded fixtures only (replay client, no model call); model id in the fixtures: claude-sonnet-5-5; 16 documents.
   - `code-of-conduct-acknowledgement.docx`
   - `complaints-management-policy-and-register.docx`
   - `conflict-of-interest-policy.docx`
   - `continuity-of-supports-plan.docx`
   - `emergency-and-disaster-management-plan.docx`
   - `governance-policy.docx`
   - `incident-management-policy-and-register.docx`
   - `induction-and-training-procedure-and-register.docx`
   - `participant-rights-and-choice-policy.docx`
   - `practice-standards-self-assessment.docx`
   - `privacy-and-information-management-policy.docx`
   - `records-management-policy.docx`
   - `risk-management-policy-and-register.docx`
   - `safeguarding-policy.docx`
   - `service-agreement-template.docx`
   - `worker-screening-and-recruitment-procedure.docx`

General information and templates for the provider's own review; not legal advice. This index is for the practising lawyer the product owner engages.
