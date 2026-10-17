# REQ-025 Session A: step 5 says what it does; the result as a list; one badge vocabulary; the glossary as the one source

Branch `req-025-session-a` (cut from `next` 5866b4a), base `next`. Compare: `next...req-025-session-a`.

## What it does (FR-1 to FR-5, FR-13; D-2216, D-2232)

- **Step 5** (`existing-step.tsx`): the heading stays "What you already have"; the intro is the two FR-1 lines, verbatim, with a test id the spec reads.
- **The result card** (`result-step.tsx`, `readiness.ts`): "Your audit: {kind}" with the glossary's meaning under it, then a list over derived counts: "Documents: N, you said you have H" / "Registers: R, you said you have K, you keep these as you go" / "Checklist: C items (N + R above plus the rest about your workers, insurance and the audit)"; the ready line keeps its two segments and its sentence is the pack line ("The pack drafts all N so they match; your checklist shows which to compare with what you have."). A zero count drops its clause for documents and registers alike (`summaryLines`, unit-tested for 0, 1, 2).
- **One badge vocabulary** (FR-4a): "You have this" / "To prepare" (not sure adds "(you said not sure)") / "Not asked"; the pack's part is the line above each list ("Your pack includes a draft of every document below." / "Your pack includes a template for every register below; the subscription keeps them for you."); the group summaries say "2 you have, 3 to prepare". The old labels are gone and the specs assert they stay gone.
- **Checklist detail** (FR-4, D-2216): a pre-ticked document or register carries "You said you have this. Compare it with the draft and keep one: an auditor needs it tailored, understood and followed." (`haveNote` on the item, rendered under the why line; unit-tested on the reference cases).
- **Why this result** (FR-5): one intro line "Each reason links to its source; the sources open in a new tab.", then one list item per reason with the source title as the link text; "Source:" and "(opens in a new tab)" no longer repeat per line.
- **The glossary** (FR-13, decision 12): `data/readyline-content/glossary.json` with the thirteen PO meanings (restrictive practice marked VERIFY against the Act s 9, as decided); `glossaryMeaning` / `glossaryTerm` / `glossarySentence` in `content.ts`; `audit-kinds.json`'s mid-term kind reads its meaning through a `{{glossary:mid-term-audit}}` token resolved at load; the checklist's "book the audit" item and the home example's summary build from it; the result page's audit-kind line is the glossary sentence and a "What these words mean (6)" disclosure at the top of "Why this result" carries the other terms on the page. A unit test fails if any of those four files carries a meaning verbatim.

## Not in this session

Session B (the stepper, from `batch-48-questionnaire`), Session C (the 45-word paragraph rule, `/sample`), and Session D (moved to REQ-027). The per-term tap-to-open form of "first use" is REQ-027's call (D-2232).

## Tests

- Unit: `readiness.test.ts` (the four lines for 0, 1, 2; the counts; the copy lint over the lines), `glossary.test.ts` (thirteen terms, 20 words, claim-free; the loader; the token; no reader keeps a copy), `derive.test.ts` (the D-2216 line on pre-ticked documents and registers only; the audit items' meanings from the glossary), `home-copy.test.ts` (the example still pins the reference case).
- E2E (three projects): `e2e/req-025.spec.ts` (AC-1 verbatim lines; AC-2 the list's numbers equal the disclosures' counts and tags and the checklist link; FR-4a vocabulary only; FR-5 one link per reason by title, "new tab" once; FR-13 the glossary disclosure; axe and width on step 5 and the open result); `questionnaire`, `req-013-p2`, `req-014`, `req-015-a11y` and `checklist` specs updated to the new words and test ids.
- Evidence: `product/evidence/req-025/` holds step 5, the result and the open result at 360 px and desktop, before (`*-before-*`) and after (`*-after-*`), from `e2e/req-025-evidence.spec.ts` (runs with `EVIDENCE=1`).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
