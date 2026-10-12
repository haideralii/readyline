# REQ-014: Visual identity v1 (tokens, typography, motif, home page)
Status: ready (apply with REQ-013 P1, before public launch)
Phase: 4   Priority: should   Owner: Dev

## Why
The app is correct and accessible but visually generic (black on white, system feel). A first-time provider decides in seconds whether a site looks trustworthy. Competitors in this space earn trust with warmth and an established feel. We want the same effect with an identity that is unmistakably ours, built on principles rather than borrowed colours, and that never trades away accessibility.

## Principles (what we learned from the market, expressed our way)
- Ink, not black. Paper, not white. One warm accent, used sparingly for the thing that matters on each screen.
- A serif for headings to feel established and human; a clean sans for everything else.
- Proof over promise: numbers and sources, never "market leading" claims (CLAUDE.md 4.3).
- The motif is the line: Readyline's identity is a horizontal line that fills as a provider gets ready. It appears in the wordmark, the step progress, the readiness summary and the registers. No competitor can own a progress line the way our name does.
- Every colour pair in the UI meets WCAG AA (4.5:1 for text, 3:1 for large text and UI); the PO has pre-checked the pairs below.

## Tokens (CSS variables on `:root`, dark mode equivalents under `[data-theme="dark"]` and `prefers-color-scheme`)
- `--paper` #F7F3EC (warm off-white page background)
- `--mist` #E6E0D6 (cards, dividers, subtle fills)
- `--ink` #1C2B2A (text and primary surfaces; a deep eucalyptus-green black, deliberately not navy)
- `--slate` #4A5553 (secondary text; 6.99:1 on paper)
- `--ochre` #B4461F (accent: the ready line, primary buttons, focus ring; 4.95:1 on paper, white on it 5.47:1)
- `--moss` #2F6B4F (success and "ready" states; 5.69:1 on paper)
- `--signal` #9A2B2B (errors; must test at 4.5:1 on paper)
- `--sky` #DCE8E6 (info backgrounds only, never text)
Dark mode: paper → #141C1B, mist → #1F2A28, ink → #F1EDE6, slate → #B8C0BD, ochre → #E0734A (check 4.5:1 on dark paper), moss → #6FBF95.

## Typography
- Headings: a serif with warmth and good screen rendering, self-hosted through `next/font` so the CSP stays strict (candidates: Fraunces, Source Serif 4, Newsreader; Dev proposes one with a rendered sample). Weight 500–600, tight tracking, sizes from a 1.25 modular scale.
- Body and UI: keep the current sans (Geist) at 16–18px with 1.6 line height for the questionnaire; never below 16px on phones.
- Numbers (standards counts, document counts): tabular figures.

## Motif: the ready line
- Wordmark: "Readyline" in the serif with a thin ochre line under "ready" that extends to the right; the line is also the favicon (ink square, ochre line) and the app icon.
- Step indicator (replaces the wrapped text indicator, REQ-013 FR-7): a single line across the top of the questionnaire that fills in ochre as steps complete, with "Step 2 of 6: Supports" beneath.
- Result summary: a line that shows how ready the provider is (documents they have versus need), moss for done, ochre for to-prepare, mist for remainder; the same line later heads the registers dashboard (REQ-009).
- Never animate the line more than once on load; respect `prefers-reduced-motion`.

## Imagery
- No stock photos of smiling consultants. Until we have permission-based photos of real providers, use no photography: paper, type, the line, and small ink line-icons. Illustration, if used, is simple single-line drawings in ink and ochre.

## Scope for v1
- FR-1 Tokens, fonts and motif applied to the shell (header, footer, buttons, inputs, cards, notices), the questionnaire and the result page.
- FR-2 Home page redesign (ties to REQ-013 FR-8): headline in the serif, the value proposition in plain words, three proof points we can stand behind (sourced to the Commission; Australian-hosted; no participant data), one example result rendered with the line, one call to action. No testimonials until real ones exist, and none ever fabricated.
- FR-3 Wordmark and favicon as SVG in the repo; brand page in `product/domain/brand.md` recording tokens and usage rules for later assets.
- FR-4 A contrast test in CI that checks every token pair used for text against AA, in both themes.

## Acceptance criteria
- AC-1 Every text/background pair in the UI meets AA in light and dark themes (automated check plus axe clean, Lighthouse accessibility 100 on all pages).
- AC-2 Fonts are self-hosted; CSP unchanged; no external origin added.
- AC-3 The step line and result line render on both Playwright projects; reduced-motion disables the fill animation.
- AC-4 Home page copy passes the claims checker; no superlatives.
- AC-5 Screenshots at 360x740 and desktop of home, one questionnaire step and the result, light and dark.

## Questions for Dev
1. Serif choice with a rendered sample of the headline "Find out what registration needs from you" at phone size.
2. How the line component is shared between the step indicator, result summary and (later) registers.
3. Estimate in sessions.

## Dev response
(Dev fills in.)

## Delivery evidence
(Dev fills in.)

## PO review
(PO fills in.)
