# Review of REQ-027, second pass

Reviewer: independent reviewer, 16 Oct 2026, SHA `2b283d2` (worktree of `main`, read-only; none of the PO's reasoning). REQ: `product/requirements/REQ-027-plain-words-and-the-flow.md`, second version (PO, 16 Oct 11:40). First pass: `product/qa/req-reviews/2026-10-16-req-027.md` (SHA 6493e2f, findings 1 to 47, Not ready). D-numbers: `DECISIONS.md` ends at D-2242; D-2701 to D-2708 collide with nothing. Eight headings per the `req-review` skill (D-2222); new findings run from 48.

## Findings 1 to 47: closed or not

| # | State | Where in v2 / what is missing |
|---|---|---|
| 1 | closed | FR-1 names the population; D-2702 |
| 2 | closed | FR-2 "the text the lint extracts ... never the raw source" (but see 48 on helper ids) |
| 3 | closed | FR-2 accepted-forms table; Test expectations |
| 4 | closed | What is already true; AC-3 "textContent and text attributes alike" |
| 5 | closed | AC-3 "the four guides" |
| 6 | partly | FR-3a and AC-4 say `tests/path-screens.test.ts` is extended; the test never reads `result-step.tsx` (PATH_FILES is `src/app/path/**` plus the finish form, line 18), so the extension is first an addition (finding 50) |
| 7 | closed | D-2708, FR-4, AC-5 (360 × 740, `android-small`) |
| 8 | closed | FR-5 names the REQ-025 AC-2 fixture and rules on "a desk audit" |
| 9 | closed | D-2704 |
| 10 | closed | FR-5 last sentence; AC-6 conditional |
| 11 | partly | D-2705 skips by `verify` field; `glossary.json` has the field on restrictive-practice only, so "and key personnel" in D-2705 is not true of the mechanism (finding 56) |
| 12 | closed | FR-2 "a verbatim copy of a meaning is not a way" |
| 13 | partly | FR-2's module-to-page map is one page per module; three of the modules render on two or three pages and `brand.ts` on every page (finding 57) |
| 14 | partly | FR-3 "every public page file that FR-2 fails ... the Dev lists them" closes the method; the "Known at 6493e2f" list still says `/sample` uses no term (`sample-document.tsx:116` "verification audit" renders there) and FR-2's walk reaches signed-in pages FR-3 never names (finding 55) |
| 15 | closed | FR-3, question 5 amended |
| 16 | closed | D-2707, FR-3a, Scope |
| 17 | partly | Scope "Out: the path pages" still contradicts FR-3's `/path/adopt`, and the named file is a redirect (finding 58) |
| 18 | closed | Status line |
| 19 | closed | Question 4, D-2707 |
| 20 | closed | What is already true; D-2701 |
| 21 | closed | D-2708 |
| 22 | closed | D-2708, AC-5 |
| 23 | closed | FR-3 token resolver, Dev response 2 ("Markdown"); the short answer is front matter, not markdown (finding 54) |
| 24 | closed | D-2702 |
| 25 | closed | FR-5, Sources |
| 26 | closed | D-2706 (the PO's choice to ship draft meanings behind the fixed line; the lawyer's point in 71) |
| 27 | closed | FR-5 |
| 28 | closed | FR-5 (Haider's phone, "Start again") |
| 29 | closed | SR-2 |
| 30 | closed | FR-2 JSON exemption, Evidence, Dev response 3 |
| 31 | closed | AC-3 names `e2e/req-027.spec.ts` and the `testMatch` |
| 32 | closed | Evidence (`console.log`) |
| 33 | closed | FR-3a (the sign-in nudge dropped, no minute count; the screen's name in 68) |
| 34 | closed | D-2707, one line |
| 35 | closed | CLAUDE.md section 1 v2.8 at 2b283d2 says the rule; the Domain rules line can now say "says" rather than "copies" |
| 36 | closed | Domain rules (ui-copy line) |
| 37 | closed | Test expectations (VoiceOver, `/pricing`) |
| 38 | closed | D-2706 (the third variant has no referent on five pages, finding 60) |
| 39 | closed | D-2707 |
| 40 | partly | FR-5's sentence to testers says "the project's public repository"; the repository is private (finding 62) |
| 41 | closed | SR-3; `before-you-buy/page.tsx:49` renders `refundPromise()[0]` from `refunds.md` |
| 42 | closed | FR-5 header sentence; AC-6 |
| 43 | closed | NEXT.md re-headed D-2223 (2b283d2's own commit) |
| 44 | partly | D-2705 and Sources say VERIFY; the skip does not fire for key personnel (11), and s 11A is now read (finding 75) |
| 45 | closed | FR-5 |
| 46 | partly | FR-3 adopts "registration group or class" but not where the spelling lives (the `dt` is `glossaryTerm(id).term`, finding 61); source now read (76) |
| 47 | closed | FR-3 (under the short answer) |

Closed 39, partly 8 (6, 11, 13, 14, 17, 40, 44, 46), open 0.

## 1. Testability

48. FR-2: "must have its `meaning` reach that page through `glossarySentence`, `glossaryMeaning`, the shared disclosure component with that id, or a `{{glossary:<id>}}` token ... never the raw source". The one inline use today is `glossarySentence(\`${pathwayWord}-audit\`)` (`result-step.tsx:336`), a template literal with no static id, and the result page's reasons come from `src/lib/standards/derive.ts` (lines 186, 194, 202: "verification audit", "certification audit"), a file the lint does not walk, so "the terms present" on that page differ per answer set and no static check can list them. Fix: say the matcher runs over extracted text while helper and component ids are read from the AST, that a template-literal id ending in `-audit` satisfies both audit terms on the result page, and that the result page's disclosure computes "present" at render from the strings it is about to show (reasons, module names and descriptions, flags, the mid-term line) with the e2e proving the count.

49. AC-3: "every glossary term present in the page's text, `textContent` and text attributes alike ... has its meaning on the page". The footer renders `AI_DISCLOSURE` on every page (`site-footer.tsx:49`: "reviewing, editing and adopting them") and "adopting" is an accepted form, so every listed page fails unless it carries "adopt"; signed in, the REQ-017 strip can read "count down to your mid-term audit" or "Adopt my documents" (`next-step.ts:92, 106`). Fix: the render check reads `main` only, skips the strip and the three allow-listed constants, and FR-2 exempts the allow-listed constants as FR-1 does.

50. FR-3a / AC-4: "`tests/path-screens.test.ts` is extended to assert the line follows the control". PATH_FILES (`path-screens.test.ts:18`) is `src/app/path/**` and the finish form; `result-step.tsx` is not read, so nothing today "holds" the result page as "What is already true" says. Fix: Session A adds `result-step.tsx` to PATH_FILES (its loading and error returns measured as the max of branches, as the test does) and a "paragraphs after the control" counter that AC-4 asserts.

51. AC-3 lists "`/start/result`, `/pricing`, the home page, the four guides, `/start` and the checklist"; FR-3 also changes `/guides`, `/guides/registration-groups`, `/path/adopt/[group]` and steps 2 to 5. Fix: AC-3 names the FR-3 set, or says which pages are render-checked and that the rest are lint-only and why.

52. AC-3 has no skip for a `verify` term while AC-2 does: "restrictive practice" is page text on `which-ndis-audit.md:46`, `practices-step.tsx` and the result page's flag (`result-step.tsx:473`), "key personnel" on the registers guide and the workforce step. Fix: AC-3 skips the same terms AC-2 skips, by the same rule.

53. FR-1: "if the result page is over 25, the shortening is Session A's work" says nothing for a guide or a content JSON file over 25, whose text is PO text the Scope puts out ("the guides' content beyond the disclosure and the token"; the content JSON strings). The lint would go red with nobody allowed to fix it. Fix: the PO shortens a guide or JSON file the measurement puts over 25 (a docs commit into the Dev's branch, as question 4 says), or the rule for those files lands after the number is set from the measurement.

54. FR-1 "the guides' paragraphs" and FR-2 "the guides' paragraphs": `lintMarkdown` strips the front matter (`copy-lint.test.ts:402`), so a guide's `shortAnswer` (three sentences, the first body text on the page, `which-ndis-audit.md:8`: "registration groups", "verification audit", "mid-term audit") and `description` are counted by neither rule, while AC-3's render check sees them. Fix: say the short answer joins both populations (the lint reads it from the front matter) and that the token resolves there too, or say it is exempt and why.

## 2. Conflicts

55. FR-2 "for every customer-facing page file" and AC-2 "given the real pages after Session A's changes, then it passes". The lint walks every `.tsx` under `src/app` and `src/components` (`copy-lint.test.ts:369`); at 2b283d2 glossary terms are page text in `src/app/registers/page.tsx` ("mid-term audit", "reportable incident", "adopt"), `src/app/path/audit-day/page.tsx` ("adopted"), `src/app/documents/[setId]/page.tsx` ("adopt"), `src/app/checklist/checklist-view.tsx` ("adopted"), `src/app/guides/[slug]/cost-calculator.tsx` ("registration group", "mid-term audit"), `src/app/guides/registration-groups/[slug]/page.tsx`, and `src/components/sample-document.tsx:116` ("verification audit", rendered on `/sample`, which the REQ says uses no term). FR-3 covers "every public page file" plus the checklist, so AC-2 cannot pass unless FR-2's walk is narrower than the lint's or FR-3 is wider. Fix: define FR-2's walk as a named list (the public pages, the questionnaire steps and the checklist) with the signed-in pages a listed follow-up, or say they take the disclosure too; correct `/sample`.

56. D-2705: "it skips a term whose glossary entry carries a `verify` field (today: restrictive practice, and key personnel until its s 11A read is in the watch file)". `glossary.json` lines 47 to 51: key-personnel has no `verify` field, and Scope says this REQ adds no glossary text, so FR-2 will demand "the people who run the business" on the registers guide and the workforce step, the meaning finding 44 said not to ship. Fix: the PO adds the `verify` field to key-personnel in a docs commit before Session A (or the skip is by id list in the test), or fixes the meaning against the s 11A read in finding 75.

57. FR-2 "a map of module to page in the test": `payments/copy.ts` renders on `/pricing`, `/account` and the result page (`SUBSCRIPTION_OFF`), `home-copy.ts` on `/` and `/sample`, `derive.ts` on the checklist and `/path/audit-day`, `brand.ts` on every page through the footer; `next-step.ts` is not in COPY_MODULES though its sentences carry "mid-term audit" and "adopt", and Test expectations say the map "covers every copy module the lint walks" (thirteen, `copy-lint.test.ts:101`). Fix: the map is module → the one page that proves it (named per module), the lawyer's constants are exempt, and `next-step.ts` is either added to the walk or stated out.

58. Scope "Out: the path pages" against FR-3's `/path/adopt`; and `src/app/path/adopt/page.tsx` is a redirect with no text: the term is in `/path/adopt/[group]/page.tsx` (the eyebrow "Adopt your documents: group 1 of N", line 47; "Adopted." line 79), a page that already explains adoption in its own words. Fix: name the file, say the eyebrow gets the bracket under FR-3's one-term rule, and amend Scope to "the path pages beyond `/path/adopt/[group]`'s bracket".

59. D-2701 "the page's first term carries its meaning inline ... every other term present is in one disclosure" against FR-3 "'What these words mean (N)' with N the count of terms present" and AC-3 "the disclosure's summary count equals the terms present": on the result page N is terms present minus the inline one (five of six today). Question 5's answer puts the home page's disclosure "under the hero" with no inline first term. Fix: N = terms present minus the inline one, and say whether the inline-first rule is the result page's only.

60. D-2706: "the other pages name the page's sources line". `/pricing`, the home page, `/start`'s intro, `/path/adopt/[group]`, `/guides` and `/guides/registration-groups` have no sources line (grep, 2b283d2). Fix: write the third variant for a page without sources ("Our plain words, not the Commission's; the result page links its sources" or the lawyer's words).

61. FR-3 "in the Commission's spelling where one exists ('registration group or class')": the disclosure's `dt` is `glossaryTerm(id).term` (`result-step.tsx:525`), so the spelling is either a second label in the component (against D-2232's one source) or an edit to `term` in `glossary.json`, which Scope forbids. Fix: the PO edits `term` (one docs commit, PO text), the matcher's forms stay "registration group(s)", and the REQ cites the Commission page in finding 76.

## 3. Domain claims

62. FR-5: each tester is told "kept without your name, in the project's public repository". The repository is private: D-2207 (NEXT.md:1592) "GitHub Actions 2,000 minutes a month while private". Fix: "in the project's repository, private today and perhaps public later".

63. Sound: the fixture facts (Sunrise Supports, 0107, one group, certification) match `e2e/req-025.spec.ts:21-25`; D-2708's "the fixture's one group" is right. No change.

## 4. Privacy and security

64. FR-5 "the 'before' page first ... once Session A is built": previews are off (D-2206), so the only served build is production after Session A's release, and Haider types the fixture on the production site on his own phone. No participant, no personal data (a fictional business). Fix: say the page is production at a named commit (AC-6 already asks for the commit), and that "say the word and I strike it" means struck from the record's current file, the history keeping an earlier version without a name.

65. Sound: SR-2 and SR-3 hold at 2b283d2. No change.

## 5. Scope and cost

66. AC-3 runs axe on nine pages across three projects; `guides.spec.ts`, `home.spec.ts`, `pricing.spec.ts` and `req-025.spec.ts` already load and axe the same pages. Each PO wording change then costs one more full run (about 45 job minutes, D-2207). Fix: one helper (`glossaryOnPage(page)`) called from the existing specs' page loads, with `req-027.spec.ts` holding only the result page's count and AC-4; or accept the duplication and say so.

67. Dev response 3 re-estimates after the first lint run; with finding 55 the failing set is about twenty files, plus the resolver and the front-matter question. Fix: bound Session A in one sentence: if the first run fails more than the FR-3 list plus five files, Session A ships FR-1, FR-2 with the failing files allow-listed by name in the test, and FR-3 on the public pages, the rest a listed follow-up.

## 6. Clarity

68. FR-3a "Next: sign in, then before you buy." The screen's heading is "Get your documents" (`before-you-buy/page.tsx:37`); "Before you buy" is the tab title only, so "then before you buy" reads as a clause, not a screen. Fix: name the screen by its heading or quote the title ("Next: sign in, then 'Before you buy'"); the PO's words.

69. FR-2 "Skipped: ... the legal pages ... and the glossary file itself": the lint walks `src/app/(legal)/*/page.tsx` (the wrappers) and `glossary.json`'s strings (the `note` key excepted). Fix: the skip is by path prefix `src/app/(legal)/` and by file name for the glossary.

70. AC-5 "a bounding box whose bottom is within 740 px of the top": of the viewport at scroll 0, or the test passes after a scroll. Fix: "at scroll position 0, in viewport coordinates".

## 7. Legal: the lawyer's read (D-2222)

71. Loophole: D-2706 treats the fixed line as the cure ("so a draft meaning never reads as a definition") and defers the lawyer's read of the thirteen meanings until after FR-3 ships, while FR-3 puts them on the home page and the four SEO guides, the pages a provider or a competitor reads first. Under the ACL a disclaimer does not cure a misleading statement; "the rules every registered provider is audited against" and "the people who run the business" are the two a provider could quote back. Fix: the lawyer reads the thirteen lines before Session A's PR (thirteen lines, under an hour), or the PO records why draft text goes public first; a question for the practising lawyer, not advice.

72. Loophole: the sentence told to testers states a fact that is false today ("public repository", finding 62) and makes a promise git history cannot fully keep ("I strike it"). A statement made to obtain someone's words should be true as made. Fix as 62 and 64.

73. Sound: FR-3a and D-2707 (the line names a screen, carries no time, never sits under a payment control) sit inside the general-information cover. Suggestion to fold in: the constant carries a one-line comment citing D-2707, so a later edit that adds "two minutes" meets the rule where it is typed.

74. Sound: FR-5's record (five sentences, a tick each, paraphrase of any name) is not personal information and the testers are outside the founder's employment (CLAUDE.md section 1 v2.8). Suggestion: the record's header says the repository's state (private, may become public) so the promise is true either way.

## 8. Domain: the NDIS expert's read (D-2222)

75. Verified (legislation.gov.au, NDIS Act 2013 C2013A00020, compilation of 18 Oct 2023, read 16 Oct 2026): s 11A(1) makes a person key personnel if they are "(a) a member of the group of persons who is responsible for the executive decisions of the person or entity" or (b) any other person with authority or responsibility for, or significant influence over, planning, directing or controlling the entity's activities; s 11A(2) includes a Corporations Act director or a member of the governing body. The glossary's "the people who run the business" under-includes (b). The REQ keeps the term off the page by D-2705, but the skip does not fire (finding 56). Fix: the PO records this read in the watch file and either fixes the meaning (REQ-025 FR-13, PO text) or adds the `verify` field now.

76. Verified (ndiscommission.gov.au, "Registration groups or classes of support", read 16 Oct 2026): the Commission's own heading uses both words, and its rule "if a provider's application includes registration groups associated with both verification and certification audits" the provider completes a certification audit, which `src/lib/standards/derive.ts:194` states. Finding 46's spelling is sourced; the REQ should cite the URL beside it. The types-of-audits page (first pass, finding 26) stays UNVERIFIED by this pass: https://www.ndiscommission.gov.au/provider-registration/apply-registration/types-audits (not fetched).

77. Sound: FR-5's correct answer ("certification" and documents will be drafted; "registered or audit-ready" fails the page) matches what the page can truthfully say. Suggestion: the record also ticks whether the tester said "visit" (the certification meaning on the audit-kind line), unscored, so the PO learns whether the meaning line is read and not only the heading.

78. Sound: the mid-term meaning ("about halfway through your three years") agrees with `home-copy.ts:86`, `registers/page.tsx:231` (18 months) and the primer. Suggestion: if finding 55 brings `/registers` into FR-3, its disclosure is where a certified provider reads the date, so the mid-term line there should sit before the "due around" sentence.

**Verdict:** Not ready. First three: 55 (FR-2's walk is the lint's whole walk, so AC-2 cannot pass and Session A builds the disclosure on an unknown set); 49 (the render check reads the footer's "adopting" on every page, so AC-3 fails everywhere unless scoped); 56 (D-2705's skip does not fire for key personnel, so the unverified meaning ships). Decisions needed: 53, 55, 56, 57, 59, 60, 61, 66, 67, 71.
