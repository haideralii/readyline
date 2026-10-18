# Acceptance self-check: REQ-022 Session C, REQ-030 Sessions A and B (Dev-2, 18 Oct 2026)

Read as the PO would, with `product/qa/review-checklist.md` and the definition of done beside each evidence file (`product/evidence/req-022/c-evidence.md`, `product/evidence/req-030/a-evidence.md`, `product/evidence/req-030/b-evidence.md`). One line per item I would fail or send back, each tied to its AC, SR or definition-of-done line, with the fix I would ask for. Anything not listed I would accept on the evidence as written.

## REQ-022 Session C (the code half)

- AC-5: the record the criterion asks for (every `launch-check.mjs` line ok against `https://<domain>`, the 301 on the three pages, `/api/health` still on the alias) does not exist; it is Haider's and the evidence says so, so the session cannot be accepted against AC-5 until LAUNCH.md section 5 is run and its output committed.
- FR-8 (AC-5's redirect), definition of done 1: the redirect has a unit test only; no end-to-end request reaches `proxy.ts` with a vercel.app host, so the wiring (the redirect running first, the 301 status and the kept path and query) is unproven in the browser. Fix: one spec that sets the `Host` header through Playwright's `extraHTTPHeaders` against the CI server with `NEXT_PUBLIC_SITE_URL` pointing elsewhere, or a manual record on the real alias.
- Definition of done 4: the once-a-session public run ended with two failures (the health spec's key pin); the fix 3ab97f8 was proven on that one spec alone, and the whole run was not repeated from the fixed build. Fix: repeat the full run from 3ab97f8 or the PR's own run stands as the proof.
- FR-1 (the Stripe webhook row): with no request host the row reads "unverified", which is also what it reads when Stripe has no endpoint at all; the two cases should not share a word. Fix: "unverified, no request host" against "unverified, no endpoint found".
- `e2e/security-headers.spec.ts` (AC-8): its header comment still says "both Playwright projects" while the config has three; a reader checking AC-8 "on every project" has to open the config to be sure. Fix: the comment names the three.

## REQ-030 Session A

- AC-1: the criterion asks for a stubbed transport that sees no call and the existing `errorId` log line when a route throws with `SENTRY_DSN` unset; `sentry.test.ts` proves only that `sentryOptions` is null without a DSN. Fix: a test that loads `instrumentation.ts` with the DSN unset and a stubbed `@sentry/nextjs`, throws through `onRequestError`, and asserts no `captureRequestError` call and the one log line with the digest.
- AC-7: only the handlers boundary test covers `/api/jobs/uptime` (the validation import and the gate); nothing asserts the 404 without the bearer, the `{ skipped }` body off production, or the `jobs.uptime.ran` row on the CI stack. Fix: a route unit test for the first two and one integration assertion for the row, as the other job routes have.
- Definition of done 3 and 7: `src/app/error.tsx` is a new customer-facing screen with no end-to-end test, no 360 px screenshot, no keyboard or contrast pass recorded. Fix: a spec that trips the boundary through a test-only throwing route and asserts the reference line, with the capture under this folder.
- AC-6: proven by `uptime.test.ts` against a stubbed GitHub API; the step in `generate-kick.yml` is shape-tested but has not run once with `PROD_URL` set, so the cache restore and save and the `GITHUB_TOKEN` issue write are unproven end to end. Not a fail against the AC as written; a line for the PO review: the first real run is the proof, and the Said-not-built list should name it.

## REQ-030 Session B

- AC-3, "the plaintext is gone": the dump is piped into gpg and never written in clear, which is stronger than the criterion, but no step shows it; a reviewer sees only that `/tmp/rehearsal.sql.gpg` exists. Fix: one line after the backup step, `test ! -e /tmp/rehearsal.sql`, and a `file` or `gpg --list-packets` line proving the artifact is a symmetric packet.
- AC-3, "a fresh stack restored from it passes the integration suite": the suite creates its own tenants, so it passes on any migrated stack whether or not the restore poured in the dumped rows. Closed the same evening (PO, 18 Oct 18:50): the rehearsal counts `auth.users` and `public.accounts` before the dump and after the restore and fails when they differ.
- AC-3, the evidence: the size and the seconds are "recorded here by the PO after the first run" and the field is still empty; the file should carry the numbers from #115's log before acceptance.
- D-2898 (FR-5): the six export tables' integration assertions (`session-c.test.ts`) have not run anywhere yet, since this tree has no Docker; #115's Supabase job on 70b52ec is their first run. Accept only on that job's green.
- AC-4 and SR-3: `backup.yml` runs under `contents: read` and uploads the encrypted copy as an artifact, so anyone with read access to the repository's Actions can download the ciphertext; the passphrase protects it (AES-256), which the REQ accepted, but the evidence should say so in one sentence under "Said, not built" so the PO reads it as a decision and not an oversight.
- FR-7 and AC-11: the privacy page's content changed in three places while `updated` stayed, by the PO's D-2870 to D-2877; the line is right against the AC, but the lawyer's question 5.8 should also ask whether a content change without a date change is acceptable practice for an APP 1 policy. One line in `questions-for-the-lawyer.md`.
- `restore-rehearsal.sh` with `--disable-triggers` on the hosted project was UNVERIFIED and said; CI then refused it on the local stack too (#115 at dea7a21), and the first version could leave a part-filled stack on a midway failure. Both closed the same evening: the restore is one psql transaction under `session_replication_role = replica`, Supabase's own pattern; a failure rolls back.

## What I would accept

REQ-022 C's FR-9 and FR-10 (the health `siteUrl`, HSTS at both values on the production build); REQ-030 A's AC-2, AC-6 (as unit-proven), AC-10 and the two launch rows; REQ-030 B's AC-4, AC-5, AC-8, AC-9 and AC-11, the backup workflow's shape and the legal lines. AC-12 of REQ-030 and AC-5 of REQ-022 are Haider's and stay open on both REQs until the live items are recorded in the PO review.
