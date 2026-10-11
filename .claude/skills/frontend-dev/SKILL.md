---
name: frontend-dev
description: Senior front-end engineer standards for this Next.js 16 (App Router, Cache Components) + TypeScript + Tailwind v4 app. Use this whenever building or changing anything a user sees or touches (pages, layouts, forms, components, navigation, loading and error states, styling, client-side logic, accessibility, performance), even if the request only says "add a page", "make a form", "fix the layout" or "it looks wrong on mobile". Also use when reviewing front-end code.
---

# Front-end engineer

You are building for a tired sole-trader support worker on a cheap Android phone at 11pm who has never heard of "modules" or "certification audits". Every screen must be obvious, fast, accessible and honest. Read `CLAUDE.md` sections 4 and 8, `product/qa/definition-of-done.md` and the open REQ before starting.

## Before you write code

1. Read the REQ's acceptance criteria and write down which screens, states and interactions they imply. If a state is missing (empty, loading, error, offline, unauthorised, expired entitlement), add it to your plan; the PO will test it.
2. Check the version-matched Next.js docs in `node_modules/next/dist/docs/01-app/` for any API you are about to use. Next 16 differs from older versions: `proxy.ts` not `middleware.ts`, async `params`/`cookies()`/`headers()`, Cache Components (`cacheComponents: true`) which makes request-time data require a `<Suspense>` boundary or `use cache`. Confirm before using an API you remember from training.
3. Decide server vs client for each component. Default to Server Components; add `"use client"` only for interactivity (event handlers, hooks, browser APIs). Keep client bundles small.
4. Look at `src/components/` for an existing component before creating one. Extend, do not duplicate.

## Non-negotiable product rules (checked in review)

- Product name is the `BRAND` constant from `src/lib/brand.ts`, never a literal. Never "NDIS" in a product or feature name; descriptive use ("aligned to the NDIS Practice Standards") is fine.
- Every page shows the general-information notice and AI disclosure (already in the footer). Document views and downloads repeat the notice near the content.
- Run every new string of marketing or guidance copy through `findProhibitedClaims` in a test. Softer overclaims ("ensures compliance", "fully compliant", "approved") are also out; say "aligned to", "prepared for your review".
- No dark patterns: no pre-ticked upsells, no fake urgency, cancellation as easy as sign-up, prices and scope visible before any commitment.
- No third-party scripts, fonts from external origins at runtime, ad trackers or analytics beyond what `DECISIONS.md` allows. `next/font` self-hosts fonts at build time.
- Free-text fields that could receive participant details carry the inline warning and reference-code hint from `CLAUDE.md` 4.5. Do not add free-text fields you do not need.
- Australian English: organisation, programme (no: use "program" for software), licence (noun), enrol, centre, behaviour, colour, prioritise. Dates as 11 October 2026 or 11/10/2026, never US order. Currency as $349 or A$349 on international contexts.

## Accessibility (WCAG 2.1 AA, verified not assumed)

- Semantic HTML first: `<main>`, `<nav>`, `<header>`, `<footer>`, `<section aria-labelledby>`, real `<button>` and `<a>`. No click handlers on `<div>`.
- One `<h1>` per page; headings in order without skipping levels.
- Every form control has a visible `<label>` (not placeholder-only), `autocomplete` where relevant, `inputmode` for numeric fields, and an error message linked by `aria-describedby`. Errors are announced (`role="alert"` or `aria-live="polite"`) and listed at the top of long forms with links to the field.
- Keyboard: everything reachable and operable with Tab, Enter, Space, Escape, arrows in menus and radio groups. Visible focus ring (global `:focus-visible` in `globals.css`); never `outline: none` without a replacement. Skip link stays first in the DOM.
- Colour contrast 4.5:1 for text, 3:1 for large text and UI boundaries. Never convey meaning by colour alone (add icon or text). Check both light and dark schemes since `color-scheme: light dark` is set.
- Touch targets at least 44x44 CSS px with 8px spacing on mobile.
- Respect `prefers-reduced-motion` (global rule exists); no autoplaying motion.
- Images: meaningful `alt`, decorative `alt=""`. Icons inside buttons get `aria-label` or visible text.
- Modals and drawers: focus trapped, Escape closes, focus returns to the trigger, `aria-modal`, background inert.
- Test with keyboard only and with a screen reader (NVDA on Windows is free) for any new flow; record the result in the REQ's delivery evidence.

## Mobile first, cheap device

- Design at 360px wide first, then enlarge. Playwright's `android-small` project is the reference device; the layout must have no horizontal scroll and no text under 16px for body copy.
- One column on phones; forms are single-column always. Sticky primary action on long forms is acceptable if it does not cover content.
- Avoid heavy client libraries. Budget: first-load JS for a page under 150 kB gzipped; check `next build` output. No charting or rich-text libraries without a `DECISIONS.md` entry.
- Use `next/image` for raster images with explicit `width`/`height` to prevent layout shift; SVG inline for icons.
- Prefer server rendering and streaming over client fetching. Where client fetch is needed, show skeletons sized like the content.

## Forms (most of this product is forms)

- Validate with the same zod schema on client and server; import the schema from `src/lib/validation/`. Never trust client validation alone.
- Save-and-resume: persist on step change and on blur for long questionnaires (server action or route handler), show "Saved" state, survive refresh and back navigation. With Cache Components, state preserved by `<Activity>` on navigation is a bonus, not a substitute for persistence.
- Progress indicator with step names, not just "3 of 9"; allow going back without losing answers.
- Plain-language questions with a one-line "why we ask" where the answer drives something (for example business structure changes the audit scope). Use the Commission's own terms with a plain gloss in brackets the first time.
- Radio groups for mutually exclusive choices, checkboxes for multi-select, selects only for long lists (states, registration groups with search).
- Destructive actions (delete account, remove register entry) require a confirmation that names the thing being deleted.

## Error, empty and edge states

- Every data view has: loading (skeleton), empty (what it is and the first action to take), error (what happened, what to do, a retry), and permission-denied states.
- Payment and entitlement states: not purchased, purchased, subscription active, past due (paused, no penalties), cancelled. Copy must never threaten fees or interest.
- Network failure during a form submit keeps the user's input and offers retry.
- Use `error.tsx` and `not-found.tsx` route files with helpful, on-brand copy; `global-error.tsx` for the root.

## Styling

- Tailwind utilities with the tokens in `globals.css`; add tokens, not ad-hoc hex values. Prettier's Tailwind plugin orders classes; do not fight it.
- Dark mode via `prefers-color-scheme` only (no toggle unless a REQ asks). Check every new surface in both.
- No inline `style` attributes except for truly dynamic values.
- Component variants via a small `cva`-style helper if the number of variants grows; otherwise plain class strings. Do not add a component library without a `DECISIONS.md` entry.

## Performance

- Lighthouse on the `android-small` emulation: Performance 90+, Accessibility 95+ for new pages (DoD item 7). Record scores in delivery evidence.
- Keep static shells static: do not read cookies or headers in layouts that wrap public pages; put request-time reads below a `<Suspense>` boundary.
- Fonts: only Geist via `next/font`; preload nothing else.
- Avoid layout shift: reserve space for images, badges and async content.

## Testing (write with the code, not after)

- Unit (Vitest + Testing Library) for any component with logic: conditional rendering, validation messages, formatting. Query by role and label, never by class or test id unless no accessible handle exists.
- Playwright for every user path in the REQ on both projects (`desktop-chromium`, `android-small`): happy path, validation error, resume after refresh, keyboard-only traversal of the main path, no `securitypolicyviolation` events once CSP exists, no console errors.
- Assertions check behaviour (text, URL, state), not implementation. No `waitForTimeout`; use web-first assertions.
- Screenshots at 360px and desktop attached to delivery evidence for any UI change.

## Delivery checklist (paste into the REQ's delivery evidence)

- [ ] AC-by-AC mapping to tests or manual records
- [ ] Keyboard-only pass and screen-reader pass noted
- [ ] Lighthouse scores on the new pages (mobile emulation)
- [ ] 360px and desktop screenshots of every new state
- [ ] Claims checker run over new copy; brand placeholder used; AU spelling
- [ ] No new dependency, or a one-line justification
- [ ] `npm run check` and `npm run test:e2e` green locally; CI green on the branch

For deeper guidance, read: `product/qa/review-checklist.md` (what the PO will try), `product/security/threat-model.md` (input and output rules), and the `ui-ux-designer` skill for visual and content decisions.
