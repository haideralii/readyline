# REQ-025 Session C: the writing rule on the public pages, and the sample on its own page

Branch `req-025-session-c` (cut from `req-025-session-a`; its compare shows Session A until that PR merges; open after it), base `next`. It also carries batch 49's guide files so the two branches merge cleanly. Compare: `next...req-025-session-c`.

## What it does (FR-10 to FR-12; D-2218, D-2235)

- **The paragraph rule** (FR-10): `lintText` takes `maxWords`; the copy lint holds a paragraph to 45 words on `/start/result`, `/pricing` (page and copy module) and the four guides; list items, summaries and the other pages keep 60; the lawyer's text (`AI_DISCLOSURE`, `GENERAL_INFORMATION_NOTICE`, `GENERAL_INFORMATION_STATEMENT`) is allow-listed by constant, not by path. The lint's own test seeds a 50-word tight block.
- **Rewrites** (FR-11): the pricing page's "How the drafts are made" lead becomes a lead and a three-item list; the guides' six remaining paragraphs over 45 words (the bold short answers and the two audit definitions) are split at a sentence or turned into lists, no new copy; `product/domain/ui-copy.md` records the lists rule and says 360 px (was 375).
- **The sample** (FR-12): `/sample` is its own page with the full sample and the Word download; the home page keeps "See exactly what you get" with the two intro sentences as bullets and a card (the sample's title, its one-line description, "N of M sections drafted from the answers", "Read the sample", "Download it as a Word file"); the hero's "See a sample document" points at `/sample`; the `before-you-buy` link now lands; `/sample` is in the sitemap. The home page's height at 360 px is measured by `e2e/req-025-c.spec.ts` as `scrollHeight` and recorded under `product/evidence/req-025/` (`home-height-before-*`, `home-height-after-*`); the spec holds it under 5,000 px; the Lighthouse budget job is untouched.

## Tests

- Units: `src/lib/copy-lint/rules.test.ts` (the tight cap fails at 50 and passes at 45; the 60 cap elsewhere), `tests/copy-lint.test.ts` (the tight file set, tag set and allow-list over the real pages, copy module and guides), the home and pricing copy tests.
- E2E (desktop and Android): `home-v2` (the hero button and the card point at `/sample`, no sample on the home page, the sample page with its tailored sections, tables and download), `req-015-width` and `req-015-a11y` with `/sample` in their page lists, `pricing`, `guides`, `req-025`, and `req-025-c` (the height).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
