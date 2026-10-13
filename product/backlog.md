# Backlog

The live work queue is `product/NEXT.md`; this table is the plan of record.

Ordered. Status mirrors the REQ file. Phases follow `CLAUDE.md` section 7.

| REQ | Title | Phase | Priority | Status |
|-----|-------|-------|----------|--------|
| REQ-001 | Standards and registration-group mapping (`data/standards.json`) | 1 | must | in progress |
| REQ-002 | Security and privacy baseline (applies from now on) | 1 | must | accepted 11 Oct; merge PR #5 |
| REQ-003 | Readiness questionnaire with save-and-resume | 2 | must | accepted 11 Oct; merge PR #6 |
| REQ-004 | Accounts, auth and tenancy (Supabase, RLS) | 2 | must | accepted; FR-9/FR-10 merged (PR #16); TOTP for the admin pending (Haider) |
| REQ-005 | Document generator and `.docx` rendering, incl. AI governance docs | 3 | must | accepted 12 Oct; PR #9 merged; sole-trader set recorded |
| REQ-006 | Readiness checklist | 4 | must | accepted 13 Oct; merged (PR #17) |
| REQ-007 | Payments: one-off pack, entitlements, download flow, refunds (subscription in REQ-009) | 4 | must | accepted 13 Oct (A, B, C); merged (PR #15); live webhook at deploy |
| REQ-008 | Legal and trust pages: terms, privacy, refunds, AI disclosure, about, footer | 4 | must | accepted 12 Oct; PRs #12, #13 merged; lawyer check before launch |
| REQ-009 | Registers: incidents, complaints, worker clearances, policy reviews, reminders | 5 | must | written 13 Oct (D-056); Session A next |
| REQ-010 | Operations: backups, monitoring, incident response runbook, data export and deletion | 5 | must | part 1 accepted 13 Oct (PR #20); deploy by Haider next; part 2 draft |
| REQ-011 | Content system and first ten SEO articles | 6 | should | draft |
| REQ-012 | Launch readiness review (security re-test, a11y audit, claims audit, performance) | 6 | must | draft |
| REQ-013 | First-time user experience and accessibility fixes (PO walkthrough 12 Oct) | 4 (P1) / 6 (P2) | must | P1 merged (PR #11); P2 merged (PR #18); home v2 merged 13 Oct (PR #22) |
| REQ-014 | Visual identity v1: tokens, serif headings, the ready-line motif, home page | 4 | should | accepted 13 Oct; merged (PR #19) |

## Road to a sellable product (agreed with Haider, 12 Oct 2026)

Order of work from here, one REQ at a time unless a REQ is blocked on the PO or on a key:

1. REQ-005 to acceptance: one full real document set for the sole-trader case, reviewed by the PO; PR #9 merged. Budget raised in steps as the cost note comes in.
2. REQ-008 legal and trust pages (PO writes copy in `product/legal/`; Dev wires pages and footer). Nothing is charged for real before this is live.
3. REQ-007 payments and download flow in Stripe test mode.
4. REQ-006 readiness checklist.
5. REQ-014 visual identity and REQ-013 P2 (home page FR-8, contact FR-9, collapsed groups FR-11): the product starts to look finished.
6. First deploy to Vercel (REQ-010 part 1: env, cron, domain, Supabase redirect URLs) and a private trial with two or three real providers.
7. REQ-009 registers and the subscription; REQ-011 content; REQ-012 launch review.

Milestone "sellable": items 1 to 6 done. Then Haider's ABN, business name, domain, bank account and Stripe live keys turn the trial into income.

Parking lot (not scheduled): fee-free list of approved auditors (no referral fees, D-109); mid-term audit countdown emails; multi-user accounts for small organisations; de-identification helper for providers' own documents; AML/CTF variant of the engine (only if LEAP conflict is cleared).
