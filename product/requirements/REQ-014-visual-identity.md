# REQ-014: Visual identity v1 (tokens, typography, motif, home page)
Status: delivered 13 Oct 2026 (batch 19 item 6, D-1401 to D-1404; R-1 to R-3 batch 20; on `main`; the PO review below is unwritten; retro review 15 Oct 2026, `product/qa/req-reviews/2026-10-15-retro-req-013-017.md`)
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
- `--signal` #9A2B2B (errors; 6.89:1 on paper, pinned by `tokens.test.ts`)
- `--sky` #DCE8E6 (info backgrounds only, never text)
Dark mode: paper → #141C1B, mist → #1F2A28, ink → #F1EDE6, slate → #B8C0BD, ochre → #E0734A (5.55:1 on dark paper, pinned by `tokens.test.ts`), moss → #6FBF95; dark signal #E07A7A is Dev's choice (D-1404).

## Typography
- Headings: a serif with warmth and good screen rendering, self-hosted through `next/font` so the CSP stays strict (candidates: Fraunces, Source Serif 4, Newsreader; Dev proposes one with a rendered sample). Weight 500–600, tight tracking, sizes from a 1.25 modular scale.
- Body and UI: keep the current sans (Geist) at 16–18px with 1.6 line height for the questionnaire; never below 16px on phones.
- Numbers (standards counts, document counts): tabular figures.

## Motif: the ready line
- Wordmark: "Readyline" in the serif with a thin ochre line under "ready" that extends to the right; the line is also the favicon (ink square, ochre line) and the app icon.
- Step indicator (replaces the wrapped text indicator, REQ-013 FR-7): a single line across the top of the questionnaire that fills in ochre as steps complete, with "Step 2 of 6: Supports" beneath. (Delivered as `ProgressLine`; REQ-025 FR-6 to FR-9, D-2217, replace it with six circles on the line when `req-025-session-b` merges, and `e2e/req-014.spec.ts`'s fill-width assertion moves with it.)
- Result summary: a line that shows how ready the provider is (documents they have versus need), moss for done, ochre for to-prepare, mist for remainder (two segments since batch 36, D-1310: have and still to do, with one sentence); the account page's register line reuses the same component (D-1310); the registers index does not carry it yet.
- Never animate the line more than once on load; respect `prefers-reduced-motion`.

## Imagery
- No stock photos of smiling consultants. Until we have permission-based photos of real providers, use no photography: paper, type, the line, and small ink line-icons. Illustration, if used, is simple single-line drawings in ink and ochre.

## Scope for v1
- FR-1 Tokens, fonts and motif applied to the shell (header, footer, buttons, inputs, cards, notices), the questionnaire and the result page.
- FR-2 Home page redesign (ties to REQ-013 FR-8): headline in the serif, the value proposition in plain words, three proof points we can stand behind (sourced to the Commission; Australian-hosted; no participant data), one example result rendered with the line, one call to action. No testimonials until real ones exist, and none ever fabricated.
- FR-3 Wordmark and favicon as SVG in the repo; brand page in `product/domain/brand.md` recording tokens and usage rules for later assets.
- FR-4 A contrast test in CI that checks every token pair used for text against AA, in both themes.

## Acceptance criteria
- AC-1 Every text/background pair in the UI meets AA in light and dark themes (automated check; axe clean on every page in the e2e specs; Lighthouse accessibility 100 on the CI pages, `/`, `/pricing`, `/start` and `/start/business`, and on the six public pages in the REQ-015 evidence; no signed-in page is measured by Lighthouse; PO decision 15 Oct 2026, retro review finding 13).
- AC-2 Fonts are self-hosted; CSP unchanged; no external origin added.
- AC-3 The step line and result line render on both Playwright projects; reduced-motion disables the fill animation.
- AC-4 Home page copy passes the claims checker; no superlatives.
- AC-5 Screenshots at 360x740 and desktop of home, one questionnaire step and the result, light and dark.

## Questions for Dev
1. Serif choice with a rendered sample of the headline "Find out what registration needs from you" at phone size.
2. How the line component is shared between the step indicator, result summary and (later) registers.
3. Estimate in sessions.

## Dev response

**2026-10-13 (batch 19, item 6; branch `req-014-visual-identity`).** Branched from `req-013-p2` rather than `main`, a deviation from the queue recorded here: FR-2 "ties to REQ-013 FR-8" and both REQs rewrite the home page and the step indicator, so a branch from `main` would conflict with P2 on exactly those files. The PO merges `req-013-p2` first; this PR then shows only the identity changes.

1. **Serif: Fraunces** (variable, optical-size axis, weight 500, tracking −0.01em), self-hosted through `next/font/google` at build time; no external origin, CSP untouched (AC-2). The rendered sample of "Find out what registration needs from you" at phone size is `product/evidence/req-014/home-light-android-small.jpg` (the headline and every heading on the page); dark in `home-dark-android-small.jpg`. Source Serif 4 and Newsreader were the alternatives; Fraunces has the warmest letterforms at 30–36 px and an optical-size axis that keeps small headings crisp.
2. **The line as one component family.** `ProgressLine` (`src/components/progress-line.tsx`) is the single-fill form: a `progressbar` for the questionnaire whose fill is the ochre line. `ReadyLine` (`src/components/ready-line.tsx`) is the segmented form: moss for done, ochre for to prepare, the mist track for the remainder, with a sentence beneath that carries the numbers; the result summary uses it now and the registers dashboard (REQ-009) will take the same props (`counts`, `noun`). Both are SVGs whose geometry is attributes, because the nonce-only CSP forbids inline styles; the fill grows from the left once on load and the global reduced-motion rule turns that off. The wordmark's underline is the same line in CSS (`.wordmark-line`).
3. **Estimate: one session**, which this is: tokens, fonts, motif, home, wordmark and favicon, brand page, contrast test, screenshots.

## Delivery evidence

### v1 (2026-10-13, batch 19 item 6), branch `req-014-visual-identity` on top of `req-013-p2` (D-1401 to D-1404)

- **Tokens (FR-1, FR-4, AC-1).** `src/lib/theme/tokens.ts` declares the eight tokens for both themes and the text pairs with their AA minimums; `src/app/globals.css` sets them on `:root`, under `prefers-color-scheme: dark` (unless `data-theme="light"`) and under `data-theme="dark"`, and exposes them as Tailwind colours (`bg-paper`, `text-ink`, `text-slate`, `bg-mist`, `bg-ochre`, `text-moss`, `text-signal`, `bg-sky`). `tokens.test.ts` (5 tests, in `npm test`, so in CI): WCAG luminance and contrast as published; every text pair meets its minimum in light and dark; the stylesheet's three token blocks equal the module; the warm ramp is monotonic and its secondary-text steps keep AA. Dark `signal` (#E07A7A, 5.97:1) was not in the PO's list and is Dev's choice; the PO's dark ochre checks at 5.5:1 on dark paper, so dark primary buttons carry dark-paper text.
- **The zinc ramp (D-1402).** The pages were built on Tailwind's `zinc` utilities with `dark:` variants; rather than rewrite every class, the `zinc` scale now resolves to a warm ramp from paper to ink (and `red-700`/`red-400` to signal), so every existing surface and text colour takes the identity and both themes keep their meaning. axe found the remapped `zinc-500` (class codes on the supports step, 40 nodes) at 4.4:1; it is now #5E6866 (5.2:1) and the test pins it.
- **Typography.** Fraunces on `h1`–`h3` at weight 500 with opsz 48; Geist body at 16 px, 1.6 line height; tabular figures on `strong`, `dd` and `.tabular`.
- **Motif (FR-3, AC-3).** Wordmark component in the header (serif, ochre line under "Ready"), `public/brand/wordmark.svg`, favicon `src/app/icon.svg` (ink square, mist track, ochre fill). `ProgressLine` and `ReadyLine` as described in the Dev response; the result summary shows "0 of 22 documents and registers in place, 6 to prepare, 16 not asked about yet" for the e2e case, and the home example shows the same line for the sole-trader reference case (pinned by `home-copy.test.ts`).
- **Shell (FR-1).** Paper background and ink text on the body; ochre focus ring everywhere; `.btn-primary` (ochre, paper text) and `.btn-secondary` (slate border) replace the eleven copies of the long button class strings across home, intro, steps, result, sign-in, account, MFA and documents; the skip link uses the tokens.
- **Home (FR-2, AC-4).** The P2 home page in the serif with the example rendered with the line; copy unchanged from P2, which the claims-lint test covers; no testimonials.
- **Brand page (FR-3).** `product/domain/brand.md`: principles, the token table with uses and the two contrast rules, typography, the motif and its components, imagery, buttons and focus, don'ts.
- **e2e** `e2e/req-014.spec.ts` (both projects): the heading's computed font family is Fraunces and the body background is paper, no request leaves the origin, the CSP still says `font-src 'self'`; dark mode flips the body to dark paper and the home page is axe clean; the step line renders with an ochre fill and `aria-valuetext` "Step 2 of 6: Supports", its animation is 0.7 s and under reduced motion effectively zero; the result line renders with its sentence and ochre to-prepare segment; with `EVIDENCE=1`, light and dark screenshots of home, pricing, sign-in, terms, the supports step and the result on both viewports (24 files in `product/evidence/req-014/`), each with an axe scan. Along the way the CSP test caught inline `style` attributes on the first version of the lines (`style-src-attr blocked`), which is why they are SVG attributes now.
- **Verification.** `npm run check` green; `npm run build` green (Fraunces fetched by next/font at build); Playwright CI mode on both projects over the identity, home, questionnaire, pricing, security headers, sign-in, legal pages, questionnaire axe and REQ-013 P2 specs: 63 passed, 1 flaky (the known empty-business-step axe scan on android-small, which reports `document-title` before the title lands; passed on retry), then the identity spec alone 6 passed. Lighthouse not run by hand this session; axe is in the specs.
- **R-1 to R-3 (2026-10-13, batch 20 item 3).** R-1: the home CTA is "See what registration needs" with the free line under it (`home-copy.ts`; the claims and reference-case tests still pass). R-2: `progressPercent(current, total)` fills by the share of steps reached (step 1 of 6: 17%, step 2: 33%, step 6: 100%, never under 4%), with a unit test per step and an e2e assertion that the supports step's fill is width 33. R-3: the completed-steps line reads "Back to: Business"; the P2 e2e asserts it. Screenshots re-captured for every page in `product/evidence/req-014/` (home and supports among them) on both viewports, light and dark; identity, P2 and home specs: 22 passed.
- **Not done.** The documents and checklist pages take the identity through the shared shell and the zinc ramp but were not screenshotted (they need a signed-in session; see REQ-006 and REQ-007 evidence). The "In development" pill in the header stays until launch.

## PO review
(PO fills in.)
