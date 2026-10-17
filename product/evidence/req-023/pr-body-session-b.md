# REQ-023 Session B: "since the last audit", the period filter and "what changed"

Base: `next`. Branch: `req-023-session-b` (cut from `next` at c343642, after #95). Built by Dev-2 (`product/CHAT-2.md`).

## What this delivers

- **FR-5 The period filter.** One pure helper (`src/lib/registers/period.ts`): the closed list (All, This registration period, Since the last audit, two dates), real ISO dates, `from` not after `to`, at most ten years, the label, the file-name suffix and the query string. The four REQ-009 registers, their exports, the audit pack and the auditor link take it; the pack and the auditor page default to the registration period (D-2305), the register pages to All. A row with no date in the period's column stays and the selector says how many (D-2318 A); the cover sheet and the audit-day list keep the whole register's states while the row counts are the file's, and the cover sheet says so (D-2318 B). The export's and the pack's file names carry the period; the cover sheet and the auditor page state it; the auditor open's audit line carries `from` and `to` (SR-3).
- **SR-3, AC-9 400 with no echo.** The proxy refuses a malformed period on `/registers`, `/path/audit-day` and `/auditor` (a page cannot set a status); the routes refuse a malformed or unavailable one; the pages parse again before any query.
- **FR-6 What changed since the last audit.** One pure module (`what-changed.ts`): counts per register for the period, documents adopted or reviewed in it, documents due before the period ends, workers whose checks were added, renewed or expired as codes and counts. The screen at `/path/audit-day/what-changed` and the pack's `since-last-audit.csv` (or `this-registration-period.csv` without a last-audit date) read the same object; every line links to the register with the period set.
- **Finding 38.** The privacy page's reminders sentence is the subscription's ("which you can turn off"); its date moves to 17 October 2026.

## Tests

- Unit: `src/lib/registers/period.test.ts`, `src/proxy.period.test.ts`, `src/lib/registers/what-changed.test.ts`; the legal-copy pin for the privacy sentence; the copy lint knows the selector component.
- E2E (desktop and Android, CI's Supabase job): `e2e/signed-in/req-023-b.spec.ts` (AC-3, AC-4, AC-9, SR-3's audit line, AC-8's worker redirect); `audit-pack.spec.ts`'s `viewer:` regex loses its end anchor for the period fields.

## Decisions and evidence

- D-2340 in `DECISIONS.md` under "REQ-023 Sessions B to D (Dev-2)"; D-2316 to D-2319 are the PO's answers in `product/CHAT-2.md`.
- ASVS rows under "REQ-023 Session B additions" in `product/security/asvs-l1-check-2026-10-14.md`; the watch entry `product/research/ndis-watch/2026-10-17-req-023-b.md` (the audit-types page timed out a third time).
- No migration. Evidence screenshots are written by the spec under `product/evidence/req-023/` with `EVIDENCE=1`; the Delivery evidence block is in the REQ on `main`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
