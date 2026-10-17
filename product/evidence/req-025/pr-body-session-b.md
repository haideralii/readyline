# REQ-025 Session B: one stepper on every questionnaire page

Branch `req-025-session-b`, base `next`. It starts from the parked `batch-48-questionnaire` work (review decision 15), which was stacked on `batch-47-public-review-fixes` (PR #59), and it carries a merge of `req-025-session-a`, so the compare shows batch 47 and Session A until those PRs merge; open it after them. Compare: `next...req-025-session-b`.

## What it does (FR-6 to FR-9, AC-4 to AC-6; D-2217)

- **One component** (`stepper.tsx`, in `step-shell.tsx`) replaces the progress line, "Back to:", "Change my answers" and "Change a step" (`progress-line.tsx` and its test are removed; nothing else used them). Line one, "Step 5 of 6: Already have", is the primary indicator, first in the `nav` and always visible; beneath it the row of six numbered circles joined by a line that fills in ochre up to the current step, labels under the circles from 640 px.
- **States** (FR-7): done is a filled circle with a tick and a plain link to `stepHref(id)`; current is a ring with `aria-current="step"`, not a link; not yet is muted, `aria-disabled="true"`, a span with no tab stop. `<nav aria-label="Questionnaire steps"><ol>`, one `li` per step, the REQ-015 focus ring, 44 px targets, CSS only, no new dependency.
- **Phones** (FR-8, decision 14): no labels under the circles; a "Show steps" `details` beside line one lists "1. Business" to "6. Result" with the same links, the current one marked and the rest muted; the circles stay plain links, so nothing nests an interaction inside the row; no sideways scroll.
- **Result page** (FR-9): one text link under the stepper, "Start again", which clears the draft after the one-screen confirm (Keep leaves everything); changing one answer is tapping its step, and later steps stay done while still valid, as before.
- The step heading carries the `focus-quiet` class so batch 49's one-line fix merges cleanly (the class is defined in that branch's stylesheet).

## Tests

- `e2e/req-025-b.spec.ts` on the three projects (desktop, Android, iPhone): line one precedes the row; six items, the current marked, five done links, four inert spans without a tab stop on step 2; 44 px circles; on a phone no labels and the disclosure with its one link and the current item, on desktop the labels and no disclosure; widths and axe on step 2 and the result; tapping a done step, later steps stay done; "Start again" keeps, then clears and lands on an empty step 1.
- `req-014.spec.ts` (the two reduced-motion assertions now accept Chromium's 1e-05 s), `req-013-p2`, `req-015-a11y` as reshaped in the parked work; `questionnaire-a11y`, `questionnaire-a11y-tree` and `req-015-width` run unchanged over the new nav.
- Evidence: `product/evidence/req-025/` gains the stepper at 360 px and desktop (`*-session-b-*`) from `e2e/req-025-evidence.spec.ts`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
