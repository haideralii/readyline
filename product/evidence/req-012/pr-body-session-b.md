# REQ-012 Session B: accessibility sweeps, the claims-and-sources table and blocking performance budgets, as checks that stay

Branch `req-012-session-b`, from `next` b14206d and merged forward to a60f7df (#121); PR to `next`. Dev-2, 18 and 19 Oct 2026. One commit per requirement with its tests, then the report; the flip of the budget job is the last commit. No migration. Report: `product/qa/launch-review/2026-10-18/session-b.md`.

## What this PR does

- **ASVS row 4.** `src/server/supabase/server.test.ts` asserts the session cookie flags on the adapter (HttpOnly, SameSite=Lax, Secure exactly when the site URL is https), so no re-verification row is without a test; D-2939 restores `.github/dependabot.yml` (weekly, grouped, majors by hand) and row 17 reads Met.
- **D-2912.** WCAG 2.2 AA is the level named everywhere the repository said 2.1 (CLAUDE.md, REQ-003, REQ-008, REQ-013, the theme tokens, the questionnaire a11y spec); the axe tag set carries `wcag22aa`.
- **FR-3a (AC-7).** `e2e/launch-review-a11y.spec.ts`: every route in `/sitemap.xml` plus the six pages it leaves out and the 404, at 360, 768 and 1280 px, both schemes, 200 % text, zero WCAG 2.2 AA violations of any impact or a ruling by rule id; the whole sweep is attached before any assertion. Clean on a local production build (60 routes; the 38 group pages share a template, two take the full matrix). `e2e/signed-in/launch-review-a11y.spec.ts` with seeded tenants (owner, worker, auditor link, invitation, report link) covers the checklist, documents, account, every register list and form, the audit pack view, the worker home and forms, the invite and report pages; it runs in this PR's Supabase job for the first time.
- **FR-3b (AC-8).** `e2e/helpers/keyboard-pass.ts`: every focusable element numbered, the walk from the top of the document, a visible ring and forward order at every stop, every element reached, each disclosure opened with Enter and closed with Escape; the public spec is green on the questionnaire's intro and two steps and the sign-in page, the signed-in half (account, registers, worker home) runs in the Supabase job. D-2943: the three "unreachable" controls were the walk's own start point; no page control changed.
- **FR-3c (D-2904).** `nvda-walk.md` and `voiceover-walk.md` in the report folder, page by page, with the "Heard" column blank for the walker.
- **FR-4a (AC-15).** Eight rules in `src/lib/claims.ts` (compliant promise, certified claim, audit-ready promise, ensures-you, will-pass, ready-to-register, free-with-fee, comparative), each with a failing and a descriptive fixture (59 tests). The two hits in the public copy are worded as the PO ruled: D-2941 retires "audit-ready" ("What keeps your evidence current"; "$39 a month keeps your registers, reminders and the mid-term audit countdown current"), D-2942 limits the comparative rule to claims against anyone and keeps the audit-kinds comparison with its reason. `the only` and `leading` are read with the noun they claim about, because the generator's lint reuses these rules on recorded replies ("I am the only worker").
- **FR-4b (AC-9, AC-16).** `scripts/ops/extract-fact-sentences.mjs` (number, date, dollar, time, hedge and instrument classes; a noise allow-list; precision printed) and `scripts/ops/claims-table.mjs` (D-2907's columns, `UNVERIFIED` first, both counts on the first line, the eight D-2908 facts by name): `claims-and-sources.md`, 114 rows, 109 `UNVERIFIED`, precision 4 %.
- **FR-4c (AC-10).** `scripts/ops/check-source-links.mjs`: every off-site link's final status; it speaks as a browser because the Commission's site refuses other agents. Three moved Commission pages relinked; `source-links.txt`: 40 of 40 answer 200.
- **FR-4d (AC-11).** `scripts/ops/source-cadence.mjs`: every source against its D-2910 cadence by kind, third-party prices at 30 days, the vendors' terms and the legal pages' `updated` dates; `source-cadence.txt`: 0 of 35 stale on 18 Oct 2026; a unit test per kind with a fixed date.
- **FR-5 (AC-12, AC-13).** `scripts/ops/lighthouse-budget.test.ts` gains page classes (public content: `/`, `/pricing`, a guide; questionnaire: `/start`, `/start/business`; signed-in: `/documents`, `/registers`, `/worker`) with total transfer (450, 550, 900 kB) and TTFB (800 ms) budgets from Lighthouse's `resource-summary` and `server-response-time` audits, beside performance 90, LCP 2,500 ms, CLS 0.1 and 250 kB of questionnaire JavaScript; the report table carries the class and both columns. CI measures eight pages, the median of five with one retry, and the job and the signed-in step lose `continue-on-error` and "advisory" in the last commit (D-2901; the budget job's last four runs on `next` are green: 23d72f2, 22ae46a, 76fc650, c2c6ff8). Local numbers beside the report: bytes 274 to 345 kB, TTFB 11 to 54 ms, LCP 1,860 to 2,082 ms, CLS 0.

## Checks

- `npm run check`: green (the count is in the report's last row).
- The signed-in sweeps, the keyboard pass's signed-in half and the signed-in budgets run in this PR's Supabase job; the public sweeps in the e2e job on three projects.

## For the PO

- The first run of the eight-page blocking budget job is this PR's; the signed-in class's byte budget (900 kB) has no measurement before it.
- The hedge sentences stand `UNVERIFIED` by name in the table for your D-2222 pass (AC-16's "sourced or reworded").

🤖 Generated with [Claude Code](https://claude.com/claude-code)
