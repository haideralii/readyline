# REQ-026: the "Start here" sheet

Branch `req-026-start-here` (cut from `next`, with `req-025-session-a` merged in for the glossary; its compare shows Session A until that PR merges; open after it), base `next`. Compare: `next...req-026-start-here`.

## What it does (FR-1 to FR-5, FR-7; D-2220, D-2221, D-2234)

- **The sheet** (`src/lib/generator/start-here.ts`, pure): five numbered sections from the pack's own data, never the model. 1 "Your pack in one minute": the audit kind with its glossary meaning, the counts, what makes a document count, how long documents take (the estimate line), the account-facts line, "not applicable" rule, and every audit word the sheet uses with its meaning. 2 "Do these first": the first group in `set-order.ts`'s order with a six-word reason each. 3 "For each document", in that order: Open (the file name), Fill in (every Finish-form blank as "Section 2, Scope: [name]"), Fill in Word (the blanks the app never sees, with the printed box and "fill this in Word"), Review (sections drafted from the answers), Make it yours (generic sections, README's words), Read once (the fixed sections as ranges), Adopt. 4 "Registers": purpose and where (the pack's template, or the app when subscribed). 5 "When you are done": the checklist and the audit-day page ("Check my systems" waits for REQ-020 Session C).
- **Counts** (FR-3): "You have N things to fill in across M documents" over the Finish-form blanks, the same set the Finish page counts; per document "K to fill in, J to review".
- **Done state** (FR-4): a "Fill in" line ticks when its blank no longer appears in the latest version (the shipped version 1 gives the lines); Word-only lines never tick; a document ticks its Adopt line when adopted.
- **Word file** (FR-1, FR-5): `00-start-here.docx` through the shared renderer, first in the zip at generation (`job.ts`, `run.ts`) and at every re-render (`rerender.ts`), and rendered fresh from the models on every download, so older sets have it too. Footer: generation date and the readiness summary version, no ids. Not a document type: not adopted, not in document control, not counted.
- **Page** (FR-1, FR-4): `/documents/[setId]/start-here`, printable, first on the set's page; `README.txt`'s "How to use them" points at the sheet (FR-7); the readiness summary keeps its blanks list.
- **Content** (`data/readyline-content/start-here.json`, Dev draft, status draft): minutes per document type, the first-step reasons, the register purposes and templates, the next steps; the estimates are PO text to edit.

## Tests

- Unit `src/lib/generator/start-here.test.ts` over the reference cases: AC-1 (order, the Fill in lines equal `formBlanks` of the shipped version, the privacy policy's three), AC-2 (two of three filled through `applyFacts` leave one open line and the counts move; a finished pack reads all done), AC-4 (every line at most 20 words, claim-free, lint-clean, every glossary term's meaning present), the Word file through the renderer with the footer, the content file covering every live type. `job.test.ts` asserts the sheet first in the zip and the README line. Evidence: `product/evidence/req-026/00-start-here.docx` and `start-here-sole-trader.txt` from the sole-trader reference case.
- E2E (desktop and Android, CI's Supabase job): `guided-path.spec.ts` gains the sheet before Finish (counts, open lines, the privacy policy's three, widths, keyboard, the download), after Finish (all lines done), and after adopt (all Adopt lines done).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
