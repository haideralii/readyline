# Batch 49: five small things from a phone walk of production

Branch `batch-49-phone-walk` (cut from `next` 5866b4a), base `next`; one PR after REQ-025 Session A, as the batch says. Compare: `next...batch-49-phone-walk`.

1. **Step heading focus ring** (`step-shell.tsx`, `globals.css`, D-2233): the global `:focus-visible` rule is unlayered, so no Tailwind utility could beat it; one class `.focus-quiet:focus-visible { outline: none }` on that heading alone turns the ring off. The heading keeps `tabIndex=-1` and the programmatic focus; the spec asserts no outline on the heading and a ring on the next Tab stop.
2. **Subscription card as a list** (`pricing/page.tsx`, `payments/copy.ts`): a price line ("AUD 39 a month for the registers, with email reminders."), the four-item list (Incident register; Complaints register; Worker checks, with expiry reminders; Policy review reminders), then "Cancel at any time; no notice period, no fee, no instalments, no interest." The linking sentence and the renewal sentence moved to the registers page's intro (`registers/messages.ts`). The `subscription-offer` test id now wraps the three parts, so the purchase-flow, subscription and pricing specs read as before.
3. **Price strip on phones** (`pricing/page.tsx`): a two-line `nav` above both cards, "Document pack: AUD 399, once" and "Registers: AUD 39 a month, cancel any time", each an anchor to its card (`#start`, `#keeps`); hidden from 640 px, so desktop is unchanged. Without a price set the lines read "one price, once" and "monthly, cancel any time"; without the subscription offered the registers line is not shown.
4. **Structure helper** (`business-step.tsx`): "Your structure changes a few audit questions; pick the one on your ABN record." The early-childhood rule stays in the result's reasons.
5. **Guides** (`content/guides/*.md`, `lib/guides/pages.ts`, `guides/[slug]/page.tsx`): each guide's front matter carries three "Short answer" lines (shown in a box under the dates) and the page lists "Jump to" links to every body heading, the FAQ and the sources (the heading ids come from the shared `slugify`, now in `lib/text/slug.ts`); the nine paragraphs over 45 words are split at a sentence boundary with no new copy. The unit test holds every body paragraph to 45 words and every guide to three lines; the e2e checks the box, the jump list and that its first link lands on a heading.

## Tests

- `e2e/batch-49.spec.ts` (desktop and Android): the heading's outline and the next stop's ring, the structure helper, the subscription list and cancel line, the strip visible on the phone and hidden on desktop, the anchor landing on the pack card, every guide's box and jump list, axe and widths on the pricing page and a guide.
- Units: `src/lib/guides/pages.test.ts` (three lines, headings, the 45-word cap), `src/lib/payments/copy.test.ts` (every string, including the price-line functions, through the claims lint), the copy lint and the text-encoding test.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
