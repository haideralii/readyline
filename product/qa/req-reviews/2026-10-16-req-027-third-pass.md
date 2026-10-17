# Review of REQ-027, third pass

Reviewer: independent reviewer, 16 Oct 2026, SHA `6efab58` (worktree of `main`, read-only; none of the PO's reasoning). REQ: `product/requirements/REQ-027-plain-words-and-the-flow.md`, third version (PO, 16 Oct 12:05, committed as fe9aaf1). Earlier passes: `product/qa/req-reviews/2026-10-16-req-027.md` (6493e2f, findings 1 to 47) and `product/qa/req-reviews/2026-10-16-req-027-second-pass.md` (2b283d2, findings 48 to 78). Also read: `product/qa/req-reviews/2026-10-16-glossary-read.md` (88f31e3, the D-2709 read, written after v3), `data/readyline-content/glossary.json` and `glossary.test.ts`, `src/lib/questionnaire/content.ts`, `tests/copy-lint.test.ts`, `tests/path-screens.test.ts`, `src/lib/copy-lint/rules.ts`, `result-step.tsx`, `home-copy.ts`, `payments/copy.ts`, `derive.ts`, `next-step.ts`, `site-footer.tsx`, `before-you-buy/page.tsx`, `auth/callback/route.ts`, `account/setup/page.tsx`, `path/adopt/[group]/page.tsx`, `sample-document.tsx`, `playwright.config.ts`, the e2e specs D-2710 names, `DECISIONS.md` (ends at D-2242; D-2701 to D-2712 collide with nothing), `product/NEXT.md` (D-2206, D-2207, D-2223), `CLAUDE.md` v2.8 and `product/domain/`. Note: the task brief says `product/DECISIONS.md` and `data/glossary.json`; the files are `DECISIONS.md` at the root and `data/readyline-content/glossary.json`. Eight headings per the `req-review` skill (D-2222); new findings run from 79.

## Findings 48 to 78: closed or not

| # | State | Evidence in v3 |
|---|---|---|
| 48 | closed | FR-2 "the ids read from the AST; a template-literal id ending in `-audit` ... satisfies both audit terms"; FR-3 "on the result page 'present' is computed at render from the strings the page is about to show" |
| 49 | closed | AC-3 "present in the page's `main` element ... outside the REQ-017 strip and the three allow-listed constants"; FR-2 "The three allow-listed constants are exempt" |
| 50 | closed | FR-3a "Session A adds `result-step.tsx` to `tests/path-screens.test.ts`'s PATH_FILES ... and a 'paragraphs after the control' counter"; verified the file passes the existing counts as it stands (one `btn-primary`, no `h1`, the early-return `<p>`s measured as the max of branches) |
| 51 | closed | AC-3 names the set and says "`/path/adopt/[group]` and steps 2 to 5 are lint-only" |
| 52 | closed | AC-3 "and outside `VERIFY_TERMS` (finding 52)" |
| 53 | closed | D-2711 "a guide or content JSON file the measurement puts over 25 is the PO's to shorten, as a docs commit into the Dev's Session A branch" |
| 54 | closed | D-2711 and FR-1 "with their front-matter `shortAnswer` and `description` (the lint reads them from the front matter)" |
| 55 | closed | D-2710 named list; FR-2; AC-2 "given a file outside the list, then it is not checked and the allow-list names it"; "What is already true" corrects `/sample` |
| 56 | closed | D-2705 "`VERIFY_TERMS` id list in the test (today `restrictive-practice`; `key-personnel` leaves the list when D-2709's meaning lands)"; but the hand-over between the skip and the meaning is a gap (finding 83) |
| 57 | closed | FR-2 module-to-page map, `next-step.ts` added, `brand.ts` exempt (the "thirteen" count is wrong, finding 93) |
| 58 | closed | Scope "the path pages beyond `/path/adopt/[group]`'s bracket"; FR-3 "the eyebrow's 'Adopt' gets the bracket" |
| 59 | closed | D-2711 "on the result page N is the terms present minus the inline one, and on every other page N is every term present" |
| 60 | closed | D-2706 third variant "the sources are on the result page and in the guides" |
| 61 | closed | D-2709 "`registration-group`'s `term` becomes 'registration group or class'"; FR-3 cites the Commission URL |
| 62 | closed | D-2712 "private today and may be public later" |
| 63 | closed | sound, no change needed |
| 64 | closed | D-2712 "runs on production at a named commit, on Haider's own phone"; FR-5 "striking removes it from the record's current file; the history keeps an earlier version" |
| 65 | closed | sound, no change needed |
| 66 | closed | D-2710 "The render check is one helper, `glossaryOnPage(page)`, called from the existing specs' page loads"; but the four named specs do not load every page in AC-3's set (finding 86) |
| 67 | closed | D-2710 "Session A is bounded: if the first lint run fails more than the named list plus five files ..." |
| 68 | partly | FR-3a "Next: sign in, then 'Get your documents'." names the heading, but it is the wrong screen for the signed-out first-time reader (finding 85) |
| 69 | closed | FR-2 "`src/app/(legal)/` by path prefix ... and `data/readyline-content/glossary.json` by file name"; D-2702's "not walked by any lint" now contradicts it (finding 94) |
| 70 | closed | AC-5 "at scroll position 0 ... in viewport coordinates" |
| 71 | partly | D-2706 "the thirteen meanings get the lawyer's and the NDIS expert's reads before Session A's PR (D-2709)" and the read exists (88f31e3); but v3 still provides for "at least two" edits where the read requires eleven, and `status: reviewed` is tied to the two (findings 79 to 82) |
| 72 | closed | D-2712 sentence is true as made ("private today and may be public later"; striking defined) |
| 73 | closed | D-2707 "the constant carries a one-line comment citing this decision" |
| 74 | closed | D-2712 "the record's header carries that sentence and the repository's state" |
| 75 | partly | Domain rules quote s 11A and D-2709 rewrites the meaning; the D-2709 wording (23 words) fails `glossary.test.ts`'s 20-word cap and differs from the read's proposal (finding 80) |
| 76 | closed | FR-3 and Sources cite the Commission page |
| 77 | closed | D-2712 "an unscored tick says whether the tester said 'visit'"; AC-6 does not admit it (finding 89) |
| 78 | closed | Scope "Session C ... `/registers`'s disclosure with the mid-term line before the 'due around' sentence" |

Closed 28, partly 3 (68, 71, 75), open 0.

## 1. Testability

79. D-2709 "the PO's edits from that read, at least two" and Scope "the meanings' content, except the two PO edits D-2709 names". The read (`2026-10-16-glossary-read.md`, verdict) says "Must change: ... eleven ... Once those eleven changes are made as proposed, the glossary's status can move from draft to reviewed", and the PO's own CHAT entry at 88f31e3 says "eleven of the thirteen meanings must change ... those edits to `data/glossary.json` go into REQ-027's Session A branch". v3 predates the read and still plans two edits with `status: reviewed` "in the same commit". Fix: D-2709 says eleven edits (the read's proposals as the PO adopts or rewords them), lists the ids, and ties `reviewed` to the eleven, not to two.

80. The proposed meanings cannot land in `glossary.json` as the file, the schema and the tests stand. `glossary.test.ts:31-36` requires each meaning to be at most 20 words with no trailing full stop; `content.ts:124` caps `meaning` at 160 characters and `GlossaryContent.parse` runs at import, so an over-long meaning fails the build, not only a test; `glossarySentence` (`content.ts:144`) appends a full stop and `result-step.tsx:528` renders `{t.meaning}.`. Of the eleven required proposals, ten exceed 20 words (verification 23, certification 29, Practice Standards 27, registration group 27, mid-term 35, restrictive practice 25, key personnel 28, self-assessment 25, worker screening 42, reportable incident 39), four exceed 160 characters (certification 180, mid-term 229, worker screening 249, reportable incident 249), and all but one end in a full stop; D-2709's own key-personnel line is 23 words. Fix: the REQ decides the form (a multi-sentence meaning with the schema cap, the 20-word test, `glossarySentence` and every `${meaning}.` render site changed in Session A, or the roles re-propose within one 20-word clause) and adds the change to Session A's estimate.

81. The meanings the read changes are hard-coded in tests and composed into other text, which "no reader keeps its own copy" (D-2232) does not cover: `glossary.test.ts:40-46` asserts the exact verification and mid-term strings; `e2e/req-025.spec.ts:65-67` asserts "An auditor reads your documents and visits you.", `:152-157` the mid-term and Practice Standards strings and the count "(6)"; `audit-kinds.json` mid-term description is "{{glossary:mid-term-audit}} For certification only, about 18 months in; it covers governance ..." (asserted by `glossary.test.ts:55-60`), which repeats the proposed meaning's "18 months" and "governance" sentence for sentence on the audit-day page; `derive.ts:387` composes "Certification audit: ${meaning}; the visit includes participant and worker interviews.", which with the proposed meaning says the interviews twice. Fix: D-2709 names these five places as Session A work with the glossary edits (the PO edits `audit-kinds.json` beside `glossary.json` in the branch; the Dev updates the two tests and `derive.ts:387`).

82. D-2705 "it skips ... today `restrictive-practice` ... The restrictive-practice meaning is REQ-025 FR-13 work; this REQ waits for it no more than before" against D-2709 "The glossary's `status` becomes `reviewed` in the same commit" and the read's item 8 ("The VERIFY tag can be cleared once the words below are adopted") and cross-cutting note ("the `verify` key can be removed when item 8's words go in"). `glossary.test.ts:50-53` asserts the `verify` key is present. A `reviewed` glossary with an unreviewed term, or a cleared term whose test still demands the key, is one of two inconsistent states. Fix: restrictive-practice joins the eleven edits, the `verify` key goes with it, the test's assertion is removed in Session A, and `restrictive-practice` leaves `VERIFY_TERMS` in the same PR (so the nine files that use the term, first pass finding 11, take its meaning in Session A: say so and count them in the bound).

83. FR-3 "`/start`'s intro and steps 2 to 5 (with `key-personnel` skipped under D-2705 until D-2709's meaning lands)" against D-2709 "Until that commit, `key-personnel` is in `VERIFY_TERMS`" and "committed into the Dev's Session A branch before its PR". At Session A's PR the skip is gone and the workforce step (`workforce-step.tsx`, two uses) and the registers guide must carry the meaning, or AC-2 fails. Fix: say Session A gives the workforce step and the registers guide key-personnel's meaning in the same PR as the edit, and drop "skipped ... until".

84. AC-3 and FR-2 after the eleven edits: the proposed meanings contain other glossary terms ("key personnel" and "risk-assessed roles" in the worker-screening meaning; "restrictive practice" in the reportable-incident meaning; "those rules" in module). The render check reads all of `main`, so a disclosure that lists "NDIS Worker Screening Check" puts "key personnel" on the page and then demands key-personnel's meaning, and so on. Fix: the render check and the lint exclude the disclosure's own `dd` text from "present", or the REQ accepts the cascade and says the disclosure lists the terms its own meanings use.

85. FR-3a "Next: sign in, then 'Get your documents'." is false for the reader it is written for. A signed-out reader who signs in with no account is sent to `/account/setup` (`src/app/auth/callback/route.ts:93`: `destination = worker ? "/worker" : "/account/setup"`), whose heading is "About your business" (`account/setup/page.tsx:18`), and `before-you-buy/page.tsx:23` redirects there too; only a reader who already has an account reaches "Get your documents" next. Fix: the line reads "Next: sign in, then 'About your business'." (or names both screens in order) and AC-4 asserts the heading of the screen the callback actually sends a new account to.

86. AC-3 "rendered on the three Playwright projects ... The check is the helper `glossaryOnPage(page)` called from the existing specs' page loads" with D-2710 naming `home.spec.ts`, `pricing.spec.ts`, `guides.spec.ts` and `req-025.spec.ts`. `pricing.spec.ts` is not in the iPhone project's `testMatch` (`playwright.config.ts:54`), so `/pricing` runs on two projects; no spec loads `/sample` (grep `goto("/sample` over `e2e/`: none); `/start`'s intro is loaded by `questionnaire.spec.ts`, not by the four; the checklist by `signed-in/checklist.spec.ts`, not named. Fix: name the spec per page (add `/sample` to `req-027.spec.ts` or `home.spec.ts`, `/start` via `questionnaire.spec.ts`, the checklist via `signed-in/checklist.spec.ts`) and either add `pricing` to the iPhone regex or say two projects for it.

87. FR-3 "On the guides the meaning reaches the page through the `{{glossary:<id>}}` token, in the body and in the front-matter short answer alike" against D-2711 "the inline-first rule is the result page's only" and D-2701 "every other term present is in one 'What these words mean' disclosure". A token resolves to a capitalised sentence (`resolveGlossaryTokens` → `glossarySentence`), not a bracket, so on a guide with four terms the text either carries four sentences in the body (per-term inline, which D-2701 rejects) and a disclosure (the meaning twice), or the disclosure alone and no token. Fix: say that on a guide the disclosure component sits in `page.tsx` under the short answer and the token is used only where a guide uses one term (the bracket form), and define the bracket form of the token (a lower-case clause, no full stop) if that is what the resolver must produce.

88. FR-5 "an answer that says the documents make them registered or audit-ready fails the page" while the result page's own offer heading reads "What keeps you audit-ready" (`result-step.tsx:412`, `payments/copy.ts:58`) and FR-4 keeps it, moved below the disclosure. A tester who repeats the page's heading fails the page by the REQ's rule, and the rule does not say what the PO then changes. Fix: say that a tester who quotes "audit-ready" from the offer heading scores as a page failure attributable to the heading (D-2001 text, out of this REQ), and whether the heading is reworded before the "after" run.

89. AC-6 "it holds the header sentence, five sentences, five ticks, the page version shown ... and nothing else" against D-2712 "the record's header carries that sentence and the repository's state; beside each sentence an unscored tick says whether the tester said 'visit'". The five "visit" ticks and the repository's state are "something else". Fix: AC-6 lists the repository's state and the five unscored "visit" ticks.

## 2. Conflicts

90. Status line "FR-3 waits for D-2709's read of the thirteen meanings" and Evidence "`product/qa/req-reviews/2026-10-16-glossary-read.md` ... (D-2709)" as a delivery item: the read exists on `main` at 88f31e3, after v3, with a verdict the REQ does not yet reflect (findings 79 to 82). Fix: the status line says the read is in and names its SHA, and the Evidence item becomes the two things that do not exist yet (the eleven edits in the branch, `status: reviewed`).

91. D-2706 "a disclaimer does not cure a misleading statement under the ACL, so the thirteen meanings get the lawyer's and the NDIS expert's reads" (right) and D-2709 "the read confirms or rewords it" for key-personnel only: the read reworded eleven, and the product's own copy outside the glossary repeats the superseded meanings in the e2e and `audit-kinds.json` (finding 81). No further fix beyond 79 to 81; noted so the Session A branch is read as one change.

92. FR-3 "it lists only the terms present, in the order they first appear" against the read's cross-cutting note "item 3 must be the first of the three in the disclosure so 'those rules' in item 4 reads" and the module proposal "a group of those rules". `supports-step.tsx:380` uses "module" with no "Practice Standards" on the step, and the home page's first term is "module" in "Practice Standards module" only by luck of line order. Fix: either the module meaning stands alone ("a group of the Practice Standards rules ...", PO text) or the disclosure orders Practice Standards before module whenever both are present and the lint fails a page with module and no Practice Standards.

93. FR-2 "the rest of the thirteen → the page that renders them" and Test expectations "every copy module in D-2710's list": `COPY_MODULES` (`copy-lint.test.ts:100-113`) has twelve entries; with `next-step.ts` added it is thirteen. Fix: "the twelve modules the lint walks today plus `next-step.ts`".

94. D-2702 "the legal pages are not walked by any lint and need no allow-list" against FR-2 "Skipped: ... `src/app/(legal)/` by path prefix" (finding 69: the lint walks the wrappers under `src/app/(legal)/*/page.tsx`). Fix: D-2702 says "the legal text in `product/legal/*.md` is not walked; the wrappers are skipped by path prefix".

95. D-2710 "the public pages (home, `/sample`, ..., `/path/adopt/[group]`)": `/path/adopt/[group]` is signed in (it loads the viewer's set), as is the checklist, which D-2710 lists separately. Fix: move `/path/adopt/[group]` beside the checklist in the list.

## 3. Domain claims

96. Domain rules quote s 11A and the Commission's registration-groups page from the second pass; the read adds the Rules s 4, s 5, s 13B, s 20, s 23, s 24, the Worker Screening Rules s 4, s 13, s 14 and the Guidelines s 5, read from legislation.gov.au on 16 Oct 2026. This pass could not reach the Rules' text (https://www.legislation.gov.au/F2018L00631/latest/text returned the table of contents only), so the read's quotations are UNVERIFIED by this pass; the primer (`ndis-registration-primer.md:20`, s 13B read 13 Oct 2026) agrees on the 18 months, the Part 3 scope and the exemptions. Fix: the REQ's Sources list the read's sources by compilation number so the next reader does not re-fetch them.

97. The read's verification and certification proposals say "It applies to lower-risk supports" / "higher-risk supports". The Rules assign the assessment method per class in the s 20(3) table and use no risk words; "lower risk" is the Commission's gloss on its types-of-audits page, which stays UNVERIFIED (https://www.ndiscommission.gov.au/provider-registration/apply-registration/types-audits, robots-blocked to every pass so far). CLAUDE.md section 2 uses the same gloss. Fix: keep the words but attribute them ("the Commission calls these lower-risk supports") or drop the sentence; a question for the NDIS expert, not a block.

## 4. Privacy and security

98. Sound: SR-1 to SR-3 hold at 6efab58; the hallway record, the "Next:" line and the disclosures carry no participant, worker or account data; the glossary edits carry no personal information. No change.

## 5. Scope and cost

99. Session A's estimate (Dev response 3: 4 to 5 hours, re-estimated after the first lint run) predates the read: eleven glossary edits with the schema, helper, test and render changes (findings 80 to 82), the nine restrictive-practice files if the term leaves `VERIFY_TERMS`, the workforce step's key-personnel meaning (83), the token's bracket form (87) and the extra spec loads (86) are new work. Fix: the Dev re-estimates against v4 before Session A, and D-2710's bound counts the glossary mechanics as part of the named list, not as "extra files".

100. Sound: D-2710's bound, the one helper and `req-027.spec.ts` holding only the result page's count and AC-4 keep the CI cost inside D-2207; a PO edit to `glossary.json` in the Dev's branch costs no extra run. No change.

## 6. Clarity

101. FR-3 "the eyebrow's 'Adopt' gets the bracket under the one-term rule": "Adopt (sign and date a document so it is yours) your documents: group 1 of N" sits over a page whose action is a button press that records a circulation date (`adopt-button.tsx`, `adopt/[group]/page.tsx:52-54`: "press the button and they become your policies"); the reader signs nothing there. Fix: the bracket goes after the eyebrow's full phrase or the page's paragraph, and D-2709 asks the PO whether "sign and date" is the product's own mechanism (the read's optional second sentence, "An auditor also looks for proof you follow it", is the part that matters on this page).

102. FR-2 "`brand.ts` exempt as the lawyer's constants": `brand.ts:33` is `AI_DISCLOSURE` itself; the file holds no other customer sentence with a glossary term, so the exemption is by constant, as D-2702 says, not by file. Fix: "`brand.ts`'s strings are the allow-listed constants and are exempt as such".

## 7. Legal: the lawyer's read (D-2222)

103. Loophole: FR-3a's line is a representation about what the product does next, made to a reader deciding whether to sign in, and it is wrong for a new account (finding 85). It is not under a payment control, so no pre-contract issue, but a line that the product's own routing contradicts on first use is the kind of small untruth CLAUDE.md 5 ("no deceptive marketing, no dark patterns") and 4.3 exist to keep out. Fix as 85; the lawyer reads the constant once it names the right screen.

104. Loophole: the "after" run scores a tester who says "audit-ready" as the page's failure while the page's offer heading says "What keeps you audit-ready" (finding 88) and `home-copy.ts:29` says the subscription "keeps you audit-ready". That heading is D-2001 text and out of this REQ, but this REQ is the one that measures whether a first-time reader takes "audit-ready" as a promise; if the hallway record shows they do, that is evidence under ACL s 18 against the heading. Fix: FR-5 says the record notes which words the tester used and that a "audit-ready" answer traced to the heading goes to the lawyer as a question about D-2001's wording; never propose the wording here.

105. Sound: D-2706's fixed line, now a courtesy and not a cure, with the reads done before the PR (D-2709), is the right order; the read's lawyer framing (attribute the law, no absolutes about the reader's own audit) is what the eleven proposals do. Suggestion to fold in: the read asks whether nominative use of "NDIS" in "NDIS Worker Screening Check" on a commercial site is fine under CLAUDE.md 4.1 (descriptive use allowed); the REQ should carry that as a question for the practising lawyer beside D-2709, since the term is the glossary's `term` and renders on the pricing page.

106. Sound: D-2712's sentence to testers is true as made and the striking rule is honest about git history; CLAUDE.md 1 v2.8 covers the testers. Suggestion: the record's header names the commit shown, so the sentence a tester read can be reproduced if one later asks what they were shown.

107. Sound: the glossary edits reaching `main` only through Session A's PR (never a `data/**` docs commit) keeps the claims lint (CLAUDE.md 4.3) over every changed meaning; `findProhibitedClaims` runs on each meaning in `glossary.test.ts:34`. Suggestion: FR-2's unit test also runs `findProhibitedClaims` over the D-2706 fixed line and the FR-3a constant, since both are new customer sentences this REQ adds.

## 8. Domain: the NDIS expert's read (D-2222)

108. The read's eleven proposals keep the legal distinctions the first two passes flagged (s 11A(1)(b) for key personnel; s 13B's 18 months, Part 3 scope and exemptions for the mid-term audit; "applicable standards" for Practice Standards; "clearance" versus "check" and the s 14 exceptions for worker screening; s 73Z(4)'s list for reportable incidents; "person with disability" and "freedom of movement" for restrictive practice; "class of supports" beside "registration group"). Two places still lose a distinction. (a) Reportable incident: the proposal says "an incident of a kind the law lists" and gives the Act's s 73Z(4) list; s 73Z(5) lets the Rules add to it and the Incident Management and Reportable Incidents Rules 2018 add the use of a restrictive practice not in accordance with a behaviour support plan (UNVERIFIED by this pass: https://www.legislation.gov.au/F2018L00633/latest/text; the primer's "five-business-day route" is the same item). Fix: "the law and the Rules list" and the NDIS expert checks the Rules' addition before `reviewed`. (b) Mid-term audit: "It covers your governance and management rules" states s 13B(5)(a) and omits (b) and (c) (any standard under a corrective action plan, any standard the Commissioner names). Fix: "It covers your governance and management rules, and anything the Commission adds."

109. Imprecise: the module proposal "a group of those rules" depends on Practice Standards being listed first (finding 92); on `supports-step.tsx:380` "module" appears with no Practice Standards on the step. Fix as 92.

110. Sound: FR-5's correct answer ("certification", documents drafted; "registered or audit-ready" fails the page) matches the certification proposal ("visits where you work and talks to people"), and the "visit" tick now records whether the meaning line is read. Suggestion: once the certification meaning carries the interviews, the fixture's audit-kind line is the sentence the tester reads first, so the record should quote that line as shown (the commit fixes it).

111. Sound: the s 11A text in Domain rules matches the read's quotation; the Commission's "registration groups or classes of support" spelling is sourced. Suggestion: FR-3's disclosure `dt` for registration group reads "registration group or class" while the chips on the card and the `aria-label` (`result-step.tsx:338-340`) say "Registration groups in scope"; that is fine, but the `aria-label` is text the render check reads, so the matcher's forms must include "registration groups" (they do: FR-2's table) and the `dt` spelling is the only place "class" appears, which is what the Commission's heading does too. No change.

**Verdict:** Not ready. The glossary read landed after v3 and changes the REQ's premise: eleven meanings must change, not two, and none of the eleven fits the glossary's schema, test or render helpers as they stand (79 to 82); the "Next:" line names a screen the product does not show a new account (85); and AC-3's render check cannot run on three pages through the specs D-2710 names (86). First three: 80 (the proposed meanings break the build and the tests until the form is decided); 79 and 82 (eleven edits and the restrictive-practice clearance, with `reviewed` tied to them); 85 (the "Next:" line's screen).

## Decisions needed

1. Eleven glossary edits or two: does D-2709 adopt the read's verdict, and is `status: reviewed` tied to all eleven (finding 79)?
2. The form of a meaning after the read: a multi-sentence meaning (raise the 160-character cap, drop the 20-word and no-full-stop tests, change `glossarySentence` and every `${meaning}.` render) or one 20-word clause re-proposed by the roles (finding 80)?
3. Does `restrictive-practice` leave `VERIFY_TERMS` in Session A, with its nine files taking the meaning in the same PR and the `verify` key and its test removed (finding 82)?
4. Does Session A give the workforce step and the registers guide key-personnel's meaning in the same PR as the edit (finding 83)?
5. Does the render check exclude the disclosure's own meanings from "present", or do the meanings' own terms cascade into the list (finding 84)?
6. The "Next:" line's screen for a new account: "About your business", both screens, or a line that names no screen (finding 85)?
7. Which spec loads `/sample`, `/start` and the checklist for `glossaryOnPage`, and does `pricing` join the iPhone regex (finding 86)?
8. On a guide: the disclosure component in `page.tsx` with the token only for the one-term bracket, and what the bracket form of the token is (finding 87)?
9. What happens when a tester repeats "audit-ready" from the offer heading: page failure attributed to D-2001's heading, and is the heading reworded before the "after" run (findings 88, 104)?
10. Does the module meaning stand alone, or does the disclosure order Practice Standards first and the lint fail a page with module and no Practice Standards (finding 92)?
11. Does the Dev re-estimate Session A against v4 with the glossary mechanics inside D-2710's bound (finding 99)?
12. Is the nominative use of "NDIS" in "NDIS Worker Screening Check" put to the practising lawyer beside D-2709 (finding 105)?
13. Does the NDIS expert check the Incident Rules' addition to the reportable-incident list before `reviewed` (finding 108)?
