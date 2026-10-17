# Readyline brand, v1 (REQ-014)

Owner: PO. Maintained by Dev as the identity changes. Everything here is
implemented in `src/app/globals.css` and `src/lib/theme/tokens.ts`; a unit
test keeps the two equal and checks the contrast pairs.

## Principles

- Ink, not black. Paper, not white. One warm accent (ochre), used sparingly
  for the thing that matters on each screen: the ready line, the primary
  button, the focus ring.
- A serif for headings (established, human); a clean sans for everything
  else. Numbers in tabular figures.
- Proof over promise. Sources and counts, never superlatives (CLAUDE.md 4.3).
- The motif is the line: a horizontal line that fills as a provider gets
  ready. It is the wordmark's underline, the questionnaire's progress, the
  result's readiness and, later, the registers dashboard. Animate it once on
  load at most; respect `prefers-reduced-motion`.
- Every text pair meets WCAG AA in both themes (test: `tokens.test.ts`).

## Tokens

| Token    | Light     | Dark      | Use                                          |
| -------- | --------- | --------- | -------------------------------------------- |
| paper    | `#F7F3EC` | `#141C1B` | page background; text on ochre and ink       |
| mist     | `#E6E0D6` | `#1F2A28` | cards, dividers, the line's track            |
| ink      | `#1C2B2A` | `#F1EDE6` | text; inverted surfaces                      |
| slate    | `#4A5553` | `#B8C0BD` | secondary text (6.99:1 on light paper)       |
| ochre    | `#B4461F` | `#E0734A` | the ready line, primary buttons, focus ring  |
| moss     | `#2F6B4F` | `#6FBF95` | success and "ready" states                   |
| signal   | `#9A2B2B` | `#E07A7A` | errors (dark value chosen by Dev for AA)     |
| sky      | `#DCE8E6` | `#1E3330` | info backgrounds only, never text            |

Rules: ochre text sits on paper only (4.95:1), never on mist (4.17:1). Sky
never carries colour-coded meaning on its own.

The Tailwind `zinc` utilities the pages were built with resolve to a warm
ramp from paper to ink (`WARM_SCALE` in `tokens.ts`), so `bg-zinc-50` is
paper and `text-zinc-900` is ink; new code should prefer the named tokens
(`bg-paper`, `text-ink`, `text-slate`, `bg-mist`, `bg-ochre`, `text-moss`,
`text-signal`, `bg-sky`).

## Typography

- Headings: Fraunces (variable, optical size axis following the rendered size),
  weight 500, tracking −0.01em, self-hosted through `next/font/google` so the
  CSP stays strict; h1 to h3 only, never body text. The scale, phone / laptop
  (`lg`): h1 32 / 44, h2 24 / 28, h3 19 / 20 (REQ-028 FR-12, D-2811).
- Body and UI: Geist at 16 px at every width and 17 px from `lg`, at a 28 px
  line (`leading-7`); prose at 65ch. The floors (REQ-028 D-2811, amending the
  earlier "never below 16 px on phones" as REQ-025 finding 9 did for the
  width): 14 px for tags, legends, table cells, the stepper's labels and the
  card mode's labels; 12 px uppercase, tracked, for a table's `<th>` from `sm`
  only; no text a person reads under 14 px anywhere.
- Numbers: `tabular-nums` on `strong`, `dd` and `.tabular`.

## Motif: the ready line

- Wordmark: "Readyline" in the serif with a 2 px ochre line under "Ready"
  that runs on to the right (`.wordmark`, `src/components/wordmark.tsx`;
  `public/brand/wordmark.svg` for other assets). Favicon and app icon:
  `src/app/icon.svg` (ink rounded square, mist track, ochre fill).
- Step indicator: `ProgressLine` (`src/components/progress-line.tsx`), a
  `progressbar` whose fill is the ochre line and whose label reads "Step 2
  of 6: Supports".
- Readiness: `ReadyLine` (`src/components/ready-line.tsx`) with moss for
  done, ochre for to prepare and the mist track for the remainder, with the
  counts in a sentence beneath for everyone. The registers dashboard
  (REQ-009) reuses it.
- Fill animation: 700 ms, once, on load; `prefers-reduced-motion` reduces it
  to nothing through the global rule.

## Imagery

No stock photography. Until there are permission-based photos of real
providers: paper, type, the line and small ink line icons. Illustration,
if any, is single-line drawings in ink and ochre.

## Buttons and focus

`.btn-primary` (ochre, paper text), `.btn-secondary` (slate border, ink
text, mist on hover), 48 px minimum height. Focus ring: 2 px ochre with a
2 px offset on every focusable element.

## Don'ts

- No "NDIS" in the wordmark, domain or product names; no NDIS logo
  (CLAUDE.md 4.1).
- No testimonials until real ones exist; none ever fabricated.
- No colour as the only carrier of meaning: the line always has its sentence.
