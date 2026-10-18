# REQ-012 Session A: the security re-test and the supply chain, as checks that stay

Branch `req-012-session-a`, from `next` 5d6cea7 and merged forward to b14206d; PR to `next`. Dev-2, 18 Oct 2026. One commit per requirement with its tests, then the report. No migration. Report: `product/qa/launch-review/2026-10-18/session-a.md`.

## What this PR does

- **FR-2 (AC-6).** Every `uses:` in the seven workflows is a commit SHA with the version in a comment (checkout v7.0.1, setup-node v7.1.0, upload-artifact v7.0.2, cache v6.1.0, gitleaks-action v3.0.0, supabase/setup-cli v3.0.1; the Node 24 majors, read against their release notes, D-2925); `setup-cli` v3 loses the removed `github-token` input; the e2e job asserts the lockfile and the tree are unchanged after `npm ci`; `workflows.test.ts` holds the shape.
- **FR-1d (AC-2).** `scripts/ops/check-headers.mjs` compares thirteen route classes with the expected-values table in `check-headers-lib.mjs` (HSTS, nosniff, referrer, permissions, frame options, no X-Powered-By, the nonce CSP with Checkout on the purchase page alone); in CI against the production build before the specs; `npm run headers -- --base <url>` on demand, GET only.
- **FR-1e (AC-3).** `tests/integration/rate-limits.test.ts` holds thirteen limits to the REQ's numbers against the real counter; `memory-limits.test.ts` the per-instance three; `rate-limit-callers.test.ts` every call site's plain refusal.
- **FR-1f (AC-4).** `src/lib/ops/rls-coverage.ts` computes the table-to-test map over the 48 `account_id` tables; the test fails on a missing kind; fourteen tables gained their cases in `rls-coverage-cases.test.ts`.
- **FR-1g.** The gitleaks path list and six fingerprints justified in place and held by `gitleaks-config.test.ts`; four fingerprints for the fixture literals the push scan flagged (D-2927).
- **FR-1a, FR-1b (AC-1).** The ASVS file gains a re-verification table: 99 rows, each with the control's `file:line` and symbol and the test that keeps it; `asvs-recheck.test.ts` opens every one. Eleven rows for what was built since 14 October. One Gap: Dependabot (D-2005 against D-2902, the PO's ruling).
- **FR-1c (AC-5).** `npm audit --omit=dev` at every level: 0 advisories (18 Oct 2026).
- **SR-1 (D-2913, D-2926).** `scripts/ops/check-report-authors.mjs` over the report folder: 0 hits.

## Checks

- `npm run check`: green, 201 files (1 skipped), 1,534 tests, 6 skipped.
- The integration half (rate limits, RLS cases) runs in this PR's Supabase job.

## For the PO

- Dependabot: D-2005 ("off until launch") or D-2902 (weekly pull requests); the pull requests #49 to #52 and #54 are superseded by the SHA pins either way.
- The four new fingerprints carry gitleaks' default rule ids for their shapes; the push scan on `main` at the next promotion is the proof.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
