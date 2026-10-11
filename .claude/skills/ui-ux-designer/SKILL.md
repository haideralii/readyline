---
name: ui-ux-designer
description: Product and UX design standards for this registration-readiness app - information architecture, screen and flow design, form and content design in plain Australian English, visual system (tokens, type, spacing, components, light and dark), states, mobile-first layouts at 360px, accessibility by design, honest pricing and no dark patterns. Use this whenever designing or critiquing a screen, flow, component, page copy, pricing page, email or document layout, or when someone asks "how should this look", "design the questionnaire", "make it clearer" or "is this good UX", even before any code exists.
---

# UI and UX designer

The user is a sole-trader support worker or a two-person provider, often on a phone, anxious about an audit they do not understand, choosing between a $5,000 consultant and a template pack. Good design here means fewer questions, plainer words, visible progress and no surprises. The design must also be honest by construction (`CLAUDE.md` sections 4.3 and 5).

## Design principles for this product

1. **Say less, mean it.** One idea per screen, one primary action, Year 8 reading level for guidance text. Replace jargon with the Commission's term plus a plain gloss on first use: "certification audit (an auditor visits your service)".
2. **Show the path.** The provider should always know where they are, what is left, and what they get at the end. Progress in named steps, a readiness checklist that moves from red to green, and dates (mid-term audit due) rather than abstract statuses.
3. **Tailored, not templated.** Surfaces must reflect the provider's own answers (their name, supports, states). Generic screens feel like the template packs they are avoiding.
4. **Honest by default.** Prices with scope beside them, refund terms one tap away, "prepared for your review" not "compliant", AI use disclosed where documents appear, cancellation as easy as subscribing. No countdown timers, scarcity, pre-ticked boxes or guilt copy.
5. **Calm visual system.** Plain, high-contrast, generous spacing, few colours. This is a tool a stressed person uses at night; it should feel like a well-organised folder, not a marketing site.
6. **Accessible by design.** WCAG 2.1 AA is a design input: contrast, target sizes, label placement, focus order and error presentation are decided in the design, not patched in code.

## Workflow for a design task

1. **Frame**: who, what job, what moment (first visit, mid-questionnaire, after purchase, the week before the audit), what they fear, what success looks like. Write it in three lines at the top of the design note.
2. **Content first**: draft the words before boxes. Headline, body, labels, help text, error text, empty state, success state. Run them through `findProhibitedClaims` and the language rules below.
3. **Flow**: list the screens and transitions; mark decisions and branches (business structure, groups chosen, SIL exclusion questions). Identify where the user can leave and resume.
4. **Wireframe at 360px** (text or ASCII is fine), then desktop. Note what collapses, what reorders, what becomes a drawer.
5. **States**: default, loading, empty, error, success, disabled, locked (not purchased or subscribed), past due, read-only.
6. **Components**: reuse `src/components/`; propose new ones only with a purpose statement and all states.
7. **Hand-off**: a design note in the REQ or `product/design/` with the content, flow, wireframes, states, token usage, accessibility notes and open questions phrased as options with a recommendation.

## Content and language rules

- Australian English, plain, second person ("you", "your service"), present tense, active voice. Sentences under 20 words in guidance text.
- Terms: participant (never client or patient), worker, provider, registration group, Practice Standards, auditor, Commission. Expand acronyms on first use per page.
- Never: guaranteed, audit-proof, approved by, official, NDIS-approved, 100%, ensures compliance, compliant (as a promise). Prefer: aligned to, prepared for your review, helps you show, typical evidence.
- Numbers: "3 of 9 steps", "$349 once", "$39 a month, cancel any time". Dates: 1 July 2026. Use "a.m./p.m." or 24-hour consistently.
- Buttons are verbs that name the outcome: "Save and continue", "Download your documents", not "Submit" or "OK".
- Error messages say what happened and how to fix it, in the field's own terms: "Enter an 11-digit ABN with no spaces".
- Help text explains why we ask when the answer drives the result: "Your business structure changes which parts of the audit apply."
- Privacy copy at every free-text field that could receive participant details: "Do not enter participant names, dates of birth, NDIS numbers or health details. Use a reference code like P-014."

## Visual system

- Tokens live in `src/app/globals.css` (`--background`, `--foreground`, add semantic tokens for surface, border, muted text, accent, success, warning, danger). Define light and dark values; check contrast in both.
- Typography: Geist via `next/font`. Scale: 14 (meta), 16 (body, never smaller on mobile), 18 (lead), 20/24/30/36 (headings). Line length 60 to 75 characters; line height 1.5 for body.
- Spacing on a 4px grid; section rhythm 24/32/48. Touch targets 44px minimum.
- Colour: one accent used sparingly for primary actions and links; semantic colours only for status, always paired with an icon or text. Grey ramps for structure.
- Components (minimum set): button (primary, secondary, danger, link), input, select, radio group, checkbox group, textarea with counter, field wrapper with label, help and error; card; alert/notice (info, warning, danger, success); progress steps; checklist item; status badge; table on desktop collapsing to stacked rows on mobile; dialog; toast for saved state; empty state block.
- Iconography: inline SVG, 20 or 24px, with text labels; never icon-only for primary actions.
- Motion: minimal; respect reduced motion; no decorative animation.

## Key screens and what good looks like

- **Home/landing**: who it is for, what you get, price with scope, the two statements (general information; AI drafts, you review), a single primary action. No logos of the Commission or NDIA.
- **Questionnaire**: named steps, one topic per step, save indicator, resume from email link, summary step that restates answers in plain language with edit links, and a clear statement of the result (which modules, which audit) before purchase.
- **Readiness checklist**: grouped by document, register, clearance, insurance; each item shows status, why it matters (one line), and the next action; locked items (subscription) show what they do and the price, never a nag.
- **Document view/download**: notice near the files, AI disclosure, "what drove this section" reviewer view, version and date, edit guidance.
- **Pricing**: the subscription as the main offer with the pack as the entry step (`CLAUDE.md` v2), what is included and excluded, refund terms link, Australian hosting and no-participant-data statements, no hidden fees, cancellation sentence.
- **Registers**: fast entry on a phone, reference-code pattern, privacy warning inline, expiry countdowns, export button.
- **Emails**: plain text first, one action, no register content, unsubscribe for anything non-transactional.

## Design review checklist

- [ ] A tired sole trader on a phone can complete the main task without help
- [ ] Every screen has a single clear primary action and visible progress or status
- [ ] Copy passes the claims checker and the language rules; AU spelling
- [ ] All states designed (loading, empty, error, success, locked, past due)
- [ ] 360px wireframe exists; nothing depends on hover or horizontal scroll
- [ ] Contrast, target size, label placement and focus order decided; both colour schemes checked
- [ ] No dark patterns; prices, scope, refunds and cancellation visible before commitment
- [ ] Privacy warning present on any free-text field that could receive participant details
- [ ] Reuses existing tokens and components; new components have all states
- [ ] Open questions written as options with a recommendation

Related skills: `ux-researcher` for evidence about users, `frontend-dev` for implementation, `product-manager` for pricing and positioning decisions.
