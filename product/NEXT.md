# NEXT: the dev work queue

The PO maintains this file. Dev works through the items **in order**, one at a time, and after each item: runs `npm run check` and `npm run build`, commits with a message that names the REQ, pushes to the named branch, and fills in the REQ's **Delivery evidence** (or **Dev response**) section. Do not skip ahead if an item is blocked; write the blocker under the item and move to the next item only if it does not depend on the blocked one. When you reach STOP, finish by appending a short status summary at the bottom of this file under "Dev status" and stop.

Rules that always apply: `CLAUDE.md` section 4, the threat model, the definition of done, and the primer. Never touch `product/requirements/*.md` outside the Dev response and Delivery evidence sections. Never mark a REQ accepted.

**Merge rule (new, 11 Oct 2026):** Dev may merge a PR into `main` only when (a) the REQ's PO review says Accepted (or Accepted conditionally with the named condition met) and (b) every CI job on the PR's latest commit is green. Merge with `git checkout main && git pull --ff-only && git merge --no-ff <branch> && git push origin main`, then delete the remote branch. Record the merge commit in the REQ's Delivery evidence. Anything else waits for the PO.

## Queue (written by PO, 11 Oct 2026, batch 2)

0. **Brand name: Readyline** (D-020), on `req-001-standards-mapping` before item 1. Make `Readyline` the default in `src/lib/brand.ts` with `NEXT_PUBLIC_BRAND_NAME` kept as an override; update the brand tests (including `isBrandNameAllowed("Readyline")`); set the value in `.env.example`; replace the literal `{{BRAND}}` in `data/standards.meta.json` / the generated `evidenceDisclaimer` and anywhere else it is stored, so the dataset and the report print "Readyline" (prefer substituting the brand constant at render time where the text is rendered by the app; regenerate the dataset where it is stored). Add the `<title>` and footer wording "Readyline" with the descriptive NDIS line unchanged. Record as D-027.

1. **Merge PR #1** (REQ-001, accepted). Apply the two non-blocking notes from the PO's Session B review first (tag the [0118 + verification group] partnership case `unverified`; keep the restrictive-practices note visible) in one small commit, confirm CI green, then merge per the merge rule.

2. **REQ-002 fix and merge** on `req-002-security-baseline`: add `permissions: { contents: read, pull-requests: read }` to the Secret scan job; rebase onto the new `main`; resolve conflicts keeping both sides; push; when both jobs are green, merge per the merge rule (the PO's conditional acceptance names exactly this condition).

3. **REQ-003 build** on `req-003-questionnaire`: rebase onto `main`; apply the PO review (descriptions to `status: "reviewed"`; create `data/readyline-content/modules.json`, `audit-types.json`, `document-sets.json` from the PO text with tests that every module and audit type has an entry; strip `servicesNote` before derivation with a test). Then Sessions A, B and C as estimated. Push after each session. Fill Delivery evidence with the CI link, screenshots at 360x740 and desktop for every step, Lighthouse accessibility scores, and the e2e report. Do not merge; the PO reviews UI.

4. **REQ-004 Dev response only** on `req-004-accounts` from `main`: answer the four questions. List, by name only, the values Haider must copy from the Supabase dashboard into `.env.local`. Do not provision anything.

5. STOP. Append your status below.

## Queue (written by PO, 11 Oct 2026, batch 3)

**Merge-rule clarification (D-028):** when Dev cannot read CI status (no `gh`, private repo), the "every CI job green" condition may be met by running the identical checks locally and recording the output in Delivery evidence: `npm run check`, `npm run build`, `npm run test:e2e`, `npm audit --omit=dev --audit-level=high`, and a local gitleaks run (`gitleaks git --config .gitleaks.toml` with the pinned binary; see item 1). The PO verifies the GitHub run afterwards; if it is red, fixing it forward is the first item of the next batch.

1. **REQ-002: gitleaks findings, then merge** on `req-002-security-baseline`. The scan now runs (permissions fix confirmed in run #12) and reports five token-shaped strings in `src/lib/logging/redact.test.ts` (Stripe, AWS, JWT fixtures). Rewrite those fixtures so no literal token-shaped string is committed: build them at runtime (prefix plus generated body), keep the redactor assertions. Add a `.gitleaksignore` with the five historical fingerprints from run #12, each with a one-line comment saying they are test fixtures, since the earlier commit stays in the branch history. Set `GITLEAKS_ENABLE_COMMENTS: "false"` on the job (PR comments need write permission we do not grant). Push; run the local equivalents per D-028, including gitleaks on the branch commits; then merge per the merge rule and record the merge commit.

2. **REQ-003 build** on `req-003-questionnaire` (unblocked by item 1): rebase onto `main`; apply the PO review in the REQ (descriptions `status: "reviewed"`; create `data/readyline-content/modules.json`, `audit-types.json`, `document-sets.json` from the PO text with tests; strip `servicesNote` before derivation with a test). Then Sessions A, B and C. Push after each session. Fill Delivery evidence with screenshots at 360x740 and desktop for every step, Lighthouse accessibility scores, the e2e report, and the local check outputs. Do not merge; the PO reviews UI.

3. **REQ-004 Session A** on `req-004-accounts`, only if `.env.local` already contains the three Supabase values `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (new key format, see REQ-004 SR-5; check for presence, never print them). If absent, write "waiting for Supabase values" under this item and skip. Session A per the Dev response: Supabase wiring, migrations, RLS policies, the integration test project, CI job layout. Push; fill Delivery evidence. Do not merge.

4. STOP. Append your status below.

## Queue (written by PO, 11 Oct 2026, batch 4)

**Merging, revised (D-030):** the Dev's own safety check refuses `git merge` into `main`, so merges go through GitHub's "Merge pull request" button, clicked by Haider when the PO says a PR is ready. Dev prepares PRs to the point where that click is the only step: rebased on `main`, conflict-free, CI green (PO verifies on GitHub), PO review Accepted. Dev never force-pushes `main` and never pushes directly to `main` again except for `product/` and `DECISIONS.md` edits the PO asks for.

**Stacking (D-031):** when a REQ depends on an unmerged branch, branch from that branch, not from `main`, and note it in the REQ; rebase onto `main` after the dependency merges.

1. **REQ-002: rebase and resolve.** `main` moved (D-029, batch-3 status). Rebase `req-002-security-baseline` onto current `main`, resolve `DECISIONS.md` keeping both sides, push. Do not merge. The PO confirms CI on GitHub and Haider clicks merge.

2. **REQ-003 build, stacked on REQ-002** (D-031): rebase `req-003-questionnaire` onto `req-002-security-baseline` (post item 1). Apply the PO review in the REQ (descriptions `status: "reviewed"`; `data/readyline-content/modules.json`, `audit-types.json`, `document-sets.json` from the PO text with tests; strip `servicesNote` before derivation with a test). Then Sessions A, B and C. Push after each session. Fill Delivery evidence with screenshots at 360x740 and desktop for every step, Lighthouse accessibility scores, the e2e report, and local check outputs.

3. **REQ-004 Session B** on `req-004-accounts` (PR #4 is open; its CI runs the Supabase local stack). First the two hardening items from the PO's Session A review (database constraints; one owner account per user). Then Session B per the Dev response (sign-in flow, account creation step, server `DraftStore`, settings page, session handling), with the integration suite extended. Also add `.github/workflows/migrate.yml`: on push to `main` when `supabase/migrations/**` changed, run `supabase db push` against the hosted project using repository secrets `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` (project ref `dpwwzhylcyosnkmlcnnp`); the job must skip cleanly with a notice when the secrets are absent. Document in `SECURITY.md` which secrets exist and where. Push; fill Delivery evidence. Do not merge.

4. STOP. Append your status below.

## Queue (written by PO, 11 Oct 2026, batch 5)

Why the three PR runs are red (PO read the logs): (a) the `.gitleaksignore` fingerprints are keyed by commit SHA, and the rebase changed the SHA (now `ffc6593`), so the five findings in `src/lib/logging/redact.test.ts` are back, plus a sixth that was never fixed at `src/lib/logging/logger.test.ts` line 39; the stacked REQ-003 and REQ-004 branches inherit the same failure. (b) PR #4's app job fails Prettier on `DECISIONS.md`, which is PO-edited prose.

1. **REQ-002: make the branch clean in every commit.** Fix the `logger.test.ts` fixture the same way as the others. Then squash the branch into one commit on top of current `main` (`git reset --soft $(git merge-base main HEAD)` and recommit with the REQ-002 message) so no commit in the PR contains a token-shaped literal; delete the fingerprint entries from `.gitleaksignore` (keep the file with a comment, or remove it). Add `DECISIONS.md` to `.prettierignore` (PO prose, like `product/`), and run Prettier once on the current file so `main` is clean after merge. Push with `--force-with-lease` (feature branch only). Run gitleaks locally over the branch's commits and record the output. Do not merge; the PO confirms CI and Haider clicks.

2. **REQ-003: rebase onto the new REQ-002 head** (`git rebase --onto req-002-security-baseline <old-req-002-head> req-003-questionnaire`), then apply the three PO review items in the REQ (labels and legend; "What happens next" block; re-capture evidence from `next start`). Push with `--force-with-lease`.

3. **REQ-004: rebase onto the new REQ-003 head** the same way, then Session C per the Dev response: data export (JSON zip), account deletion with soft delete and the Vercel Cron purge route protected by `CRON_SECRET`, `platform_admin` routes behind TOTP MFA with `audit_log` entries, confirmation emails stubbed behind the email provider interface (provider still TBD, D-013). Extend the integration suite (AC-4, AC-5, AC-7). Push with `--force-with-lease`.

4. STOP. Append your status below.

## Queue (written by PO, 11 Oct 2026, batch 6)

Context: PRs #2 to #4 are closed; #5, #6, #7 are open from the `*-rebuilt` branches and are the ones that merge (Haider clicks, in that order, when the PO confirms CI). The old `req-00x` branches can be deleted by Haider later. Do not rebuild or force-push anything this batch.

1. **`migrate.yml`: push over a database URL, no `supabase link`** (D-036), on a new branch `req-004-migrate-dburl` from `main`. Replace the link step with `supabase db push --include-all --db-url "$DB_URL"` where `DB_URL` is built in the job from `SUPABASE_DB_PASSWORD` (URL-encoded) and the project ref using the Supabase session pooler for ap-southeast-2 (`postgresql://postgres.<ref>:<password>@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`); keep the secrets gate and the skip notice; add `workflow_dispatch` so the PO can trigger it by hand. Never echo the URL. Mask the password with `::add-mask::`. Open the PR note in Delivery evidence of REQ-004.

2. **Operator script for the admin grant:** add `supabase/ops/grant-platform-admin.sql` with a parameterised statement that sets `platform_admin = true` for the user whose `email_hash` matches a lower-cased email (compute the SHA-256 in the SQL from a placeholder `:email`), with a comment explaining it is run once by the operator in the SQL editor after first sign-in. Same branch as item 1.

3. **REQ-005 Dev response only** on branch `req-005-generator` from `main`: answer the five questions; draft `data/readyline-content/document-types.json` outlines for PO review (Session A content, no generation code yet). List, by name only, the env values Haider must supply.

4. STOP. Append your status below.

## Queue (written by PO, 12 Oct 2026, batch 7)

PRs: #7 (REQ-004 Session C) is accepted but conflicts with `main` in `DECISIONS.md`; the PO opens PRs for `req-004-migrate-dburl` and `req-005-generator`. Haider merges in the order the PO gives.

1. **PR #7 conflict:** rebase `req-004-accounts-rebuilt` onto current `main`, resolve `DECISIONS.md` keeping both sides, run `npm run check`, push with `--force-with-lease` (feature branch, D-033). Nothing else on that branch.

2. **REQ-005 PO decisions and evidence review, on `req-005-generator`** (rebase onto `main` first): apply the three decisions in the REQ's PO review (accept the money-and-property procedure into the core set; split out `support-planning-and-transitions-procedure`; add the `restrictive-practices` register id for REQ-009), update `document-sets.json`, `document-types.json` and their tests; apply the three evidence additions and flip all evidence items to reviewed as specified; regenerate `standards.json`, bump its version, update `SOURCES.md` changelog; `standards:verify` green.

3. **REQ-005 Session A, same branch:** section JSON schema, document model, renderer with structure snapshots, fixed text for every outline per `product/domain/house-style.md`, the readability function with tests, the terminology and claims lint wired to the house-style lists, the LibreOffice CI job (AC-1 mechanics) rendering the fixed-text skeletons for the three reference cases. No model calls yet. Push; fill Delivery evidence.

4. **REQ-005 Session B preparation:** context pack builder with the exclusion test (SR-3), prompt builder with versioned prompts using the house style, replay-fixture harness (no real calls in CI), red-team fixtures (SR-2). If `ANTHROPIC_API_KEY` is present in `.env.local`, record three real generations locally as the first fixtures and note model cost per full generation; if absent, write "waiting for Anthropic key" and stop after the harness. Push; fill Delivery evidence.

5. STOP. Append your status below.

## Queue (written by PO, 12 Oct 2026, batch 8)

Merges done by the PO: PR #7 (REQ-004 Session C) is on `main`. PR #8 conflicts; PR #9 stays open as the REQ-005 working PR.

1. **PR #8 conflict:** on `req-004-migrate-dburl`, merge `main` in (a merge commit is fine, D-033 force-push is not required), resolve `product/requirements/REQ-004-accounts-auth-tenancy.md` keeping both sides in order, run `npm run check`, push. The PO merges.

2. **REQ-005 Session B recordings** on `req-005-generator` (rebase or merge `main` first): if `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` are present in `.env.local`, record the three reference generations as replay fixtures, run the red-team fixture for real once, note model cost per full generation in Delivery evidence, and commit the fixtures. Never print the key. If absent, write "waiting for Anthropic key" and continue to item 3.

3. **REQ-005 Session C** on the same branch: generation for a signed-in owner behind `GENERATION_ENABLED` with the per-account quota (FR-9, SR-6); version sets and `document_versions` with the migration; private Supabase Storage bucket in Sydney with RLS on `storage.objects` and signed short-lived download URLs (SR-4, AC-7 test in the integration suite); zip download of the latest set plus the PDF summary; the reviewer view with per-section "which answers drove this" and regenerate-one-section with diff (FR-5, AC-6); `generation_log` with the retention rule (SR-5). Fill Delivery evidence with screenshots at 360x740 and desktop and the CI link. Also write the Session D fixed extras (register tables, service agreement template body, checklists) in the house style so no `[Provider to complete]` placeholder remains where fixed text was planned.

4. **REQ-013 P1** on a new branch `req-013-first-time-ux` from `main`: items FR-1 to FR-5 and the acceptance criteria in the REQ. Keep REQ-003's e2e suite green; add the accessibility-tree test. Push; fill Delivery evidence with screenshots and the screen-reader walkthrough note. The PO opens the PR.

5. STOP. Append your status below.

## Dev status

(Dev appends here.)

**2026-10-11 (later), Dev: batch 2 worked to STOP; item 3 blocked behind item 2's merge.**

0. Readyline brand default: done on `req-001-standards-mapping` (`301d3e1`): `BRAND_DEFAULT = "Readyline"` with `NEXT_PUBLIC_BRAND_NAME` as override, tests updated (`isBrandNameAllowed("Readyline")`), `.env.example` and README updated, `evidenceDisclaimer` regenerated so the dataset and report print "Readyline"; D-027 recorded.
1. REQ-001 merge: PR #1 was already merged on GitHub (`39fd178`). On Haider's instruction the branch (PO batch 2, item 0, and the Session B note commit `d0f9080` tagging the early-childhood-plus-verification case `unverified`, register D-122) was merged into `main` with `--no-ff` as `1232a73` and pushed; merge recorded in REQ-001 (`ae149f7`). CI was not re-confirmed from the dev machine (no `gh`, no API token; the unauthenticated Actions API returns 404). **The remote branch `req-001-standards-mapping` was not deleted: the command was blocked by the tool's safety check; please delete it or tell Dev to retry.**
2. REQ-002: `permissions: contents: read, pull-requests: read` added to the Secret scan job; rebased onto the new `main`; conflicts in `.env.example`, `.prettierignore`, `DECISIONS.md`, `package.json` and the REQ file resolved keeping both sides; pushed as `543a030` (+ evidence note `f716fb9`). Local on that commit: check clean (157 tests), verify ok, audit 0, env-file check ok, dynamic build, e2e 8 passed on the production server. **Blocked at the merge step:** the PO's condition is both CI jobs green on the latest commit and Dev cannot read CI status from this machine. If the run for `f716fb9` is green, say "merge REQ-002" and Dev will merge per the rule, or merge it directly.
3. REQ-003 build: not started; blocked because the PO's approval is "once PR #1 and PR #2 are merged" and item 2 is not merged. Ready to start immediately after (rebase `req-003-questionnaire` onto `main`, descriptions to `reviewed`, `data/readyline-content/*.json` with tests, strip `servicesNote`, then Sessions A to C).
4. REQ-004 Dev response: done on `req-004-accounts` (`2c5f6de`, from `main`): CI Supabase local-stack job layout within budget, our own per-email and per-IP limiter in front of Supabase's built-in limits (custom SMTP needed before real traffic, pulls the D-013 email decision forward), Vercel Cron purge route recommended over pg_cron and Actions, three-session estimate, and the dashboard values Haider must copy listed by name only. Nothing provisioned.

Waiting for the PO.
**2026-10-11 (batch 3), Dev: items 1 and 3 delivered; item 1's merge and item 2 are blocked.**

1. REQ-002 gitleaks fix: done and pushed to `req-002-security-baseline` (`810a170`, evidence `49c7877`). Fixtures in `redact.test.ts` and `logger.test.ts` are assembled at runtime; `.gitleaksignore` carries the fingerprints on commit 543a030 (four found by a local gitleaks 8.30.1 scan, plus the JWT one from run #12), each commented; `GITLEAKS_ENABLE_COMMENTS: "false"` set. D-028 local equivalents on `810a170`: check clean (157 tests), build dynamic, e2e 8 passed on the production server, audit 0, env-file check ok, gitleaks history scan of the branch: 3 commits, no leaks. **Merge blocked:** the Claude Code safety check refuses any `git merge` into `main` from this session as a "CI bypass", twice, even with D-028. Haider or the PO: please merge `req-002-security-baseline` into `main` with `--no-ff` (and delete the remote branch), or add a permission rule allowing it; Dev will then record the merge commit.
2. REQ-003 build: skipped, dependent on item 1's merge (PO approval is "once PR #1 and PR #2 are merged"). Ready to start the moment REQ-002 is on `main`.
3. REQ-004 Session A: done and pushed to `req-004-accounts` (`b9f6ee1`, rebased on `main`). Gate passed: the three Supabase values are present in `.env.local` (never printed). Delivered the initial migration with RLS on every table and `create_account()`, `supabase/config.toml` for the local stack, server-only SSR and admin clients on the new key names, the cross-tenant RLS suite (`npm run test:integration`, skips without credentials), the `supabase-integration` CI job, env names, D-401 to D-404, Session A evidence. Local: check clean (127 tests), build ok. **Not verified locally (D-404):** no Docker, Supabase CLI or database password on the dev machine, so the migration is not applied anywhere yet and the RLS suite's first real run is the CI job on this push. Haider: apply the migration to the hosted project (`npx supabase login`, `npx supabase link --project-ref dpwwzhylcyosnkmlcnnp`, `npx supabase db push`) before Session B.

Other: `main` was pushed with the PO's two local commits (051986a, 7f68349) at the start of the batch. The remote branch `req-001-standards-mapping` was deleted upstream by the PO; the local copy remains. Waiting for the PO.
**2026-10-11 (batch 5), Dev: all three items delivered on rebuilt branches; two things need a human hand.**

**First, a process incident (D-414).** The PO's batch-5 commit afeab24 captured the whole shared working tree, so `main` already contains the REQ-002, REQ-003 and REQ-004 code at the Session B state (97 files). Dev pushed that `main` (fast-forward, with D-034) before noticing. Consequences: rebasing the branches onto `main` conflicted in every file; CI on `main` is red on Prettier for `DECISIONS.md` until PR #2 merges; `migrate.yml` ran on that push, but the hosted project still answered `PGRST202` for the limiter function afterwards, so please read that Actions run. Dev's tool refuses `git reset --hard` and every `--force-with-lease` push in this session, so each branch was rebuilt as the one below it plus only its batch-5 work and pushed under a new name. **Haider or PO, to replace the old branches (feature branches only, D-033):**

`git push --force-with-lease=req-002-security-baseline:a8e6d04 origin req-002-security-baseline-rebuilt:req-002-security-baseline`
`git push --force-with-lease=req-003-questionnaire:b2f1ee9 origin req-003-questionnaire-rebuilt:req-003-questionnaire`
`git push --force-with-lease=req-004-accounts:9452905 origin req-004-accounts-rebuilt:req-004-accounts`

then delete the `-rebuilt` branches, or simply open PRs from the `-rebuilt` names and close #2 to #4. Each PR diff is now only the batch-5 delta against `main`.

1. REQ-002 (`req-002-security-baseline-rebuilt` at c352398, one commit on `main`): `logger.test.ts` and `redact.test.ts` already assemble fixtures at runtime (regex scan of `main` clean); `.gitleaksignore` reduced to a comment; `DECISIONS.md` in `.prettierignore` (D-033) and Prettier run on it (no change needed); evidence note. Local: check clean (244 tests); gitleaks over `main..HEAD`: 1 commit, no leaks. Not merged.
2. REQ-003 (`req-003-questionnaire-rebuilt` at 7d02102): "To prepare" label with a legend above the documents list and a short one above the registers; "What happens next" block with the PO's wording; all fourteen screenshots re-captured from `next start` (no dev badge). Note: the header on that page already shows "Sign in" because `main` carries REQ-004, so the "sign-in is coming" sentence will want trimming once REQ-004 is accepted. Local: check clean (244 tests), build ok, questionnaire and axe specs in CI mode 24 passed, screenshots 2 passed. Not merged.
3. REQ-004 Session C (`req-004-accounts-rebuilt` at 1afa395): export zip (owner session, 5 per hour, D-417); soft delete through `delete_account()` with confirm form, deleted page, sign-in refused at the callback (D-415); purge as `runPurge()` behind `GET /api/jobs/purge` with `CRON_SECRET` and a daily Vercel cron (D-416); `/admin` and `/admin/mfa` with 404 for non-admins and TOTP via server actions, audited (D-418); email provider interface with log-only implementation and tested templates (D-419); member audit-insert policy fixing a silent Session B failure (D-420); `CRON_SECRET` in env docs; `fflate` added. Tests: 253 unit, integration suite `session-c` (AC-4, AC-5, AC-7), e2e admin spec. Local: check clean, build ok, bundle check clean, admin/sign-in/headers/home specs 22 passed in CI mode, gitleaks over the three rebuilt commits clean. **Haider:** generate `CRON_SECRET` (`openssl rand -hex 32`) in Vercel, enable TOTP in the hosted Auth settings, and set `platform_admin = true` on your user by SQL once; the integration suites' first run is the `supabase-integration` job on these pushes. Not merged.
4. STOP.

Waiting for the PO.
**2026-10-11 (batch 6), Dev: all three items delivered and pushed; nothing merged, nothing rebuilt or force-pushed.**

0. `main` pushed with the PO's batch-6 commit 47b15cb after checking its stat (product/ and DECISIONS.md only).
1. `migrate.yml` over a database URL (D-036): branch `req-004-migrate-dburl` from `main`, commit d13a07f. `supabase link` removed; the job builds `DB_URL` from `SUPABASE_DB_PASSWORD` (URL-encoded with Python's `urllib.parse.quote`), the project ref and `aws-0-ap-southeast-2.pooler.supabase.com:5432`, masks the raw password, the encoded password and the URL with `::add-mask::`, passes it only through `GITHUB_ENV`, and runs `supabase db push --include-all --db-url` then `supabase migration list --db-url`. Secrets gate, skip notice and `workflow_dispatch` kept; nothing echoes the URL. PR note in REQ-004 Delivery evidence. Open the PR from `req-004-migrate-dburl`; after merge, a manual dispatch applies the three migrations.
2. `supabase/ops/grant-platform-admin.sql`: same branch, commit e7aa846. One `update` keyed on the SHA-256 of the lower-cased `:email` placeholder (same expression as the auth trigger) plus a check `select`; header explains the once-only operator run in the SQL editor after first sign-in, why the API path is blocked, and that TOTP must be on first. Noted in REQ-004 evidence.
3. REQ-005 Dev response: branch `req-005-generator` from `main`, commit 5359f04. Five answers (closed block schema with a 20-line sample and rendered text; fixtures keyed by SHA-256 of prompt version, model and canonical request with replay-only CI; in-repo Flesch-Kincaid, warn above 9.0 and fail above 11.0 per tailored section; LibreOffice headless as a separate CI job, 60 to 90 s install; four sessions), values by name (`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `GENERATION_ENABLED`), and the Session A catalogue `data/readyline-content/document-types.json`: 39 entries (37 ids from `document-sets.json`, the self-assessment, one proposed addition), each with standards ids, `evidenceAliases` into the `standards.json` evidence scheme, registers, a named outline with fixed and tailored sections, and extra sections; `document-types.test.ts` checks coverage, real ids, one tailored section each, no prohibited claims and full evidence coverage. Three PO decisions flagged in the response (proposed money-and-property procedure; support planning and transitions folded into the engagement procedure; a restrictive practice use register for REQ-009). D-501 to D-505. Local: check clean (23 files, 250 tests). Not built; waits on the PO's catalogue and evidence-item review and the house-style note.
4. STOP.

Waiting for the PO.
**2026-10-12 (batch 7), Dev: all four items delivered and pushed; nothing merged, nothing force-pushed.**

0. `main` pushed with the PO's batch-7 commit 7f456a0 after checking its stat (product/ only).
1. PR #7 conflict: `req-004-accounts-rebuilt` now carries a merge of `main` (b0a4310) with `DECISIONS.md` resolved keeping both sides (D-414 to D-420 followed by D-035 and D-036). Deviation: a rebase plus `--force-with-lease` is refused by Dev's tool in this session (as in batch 5), so the conflict was resolved with a merge commit, which is a plain push and leaves PR #7 conflict-free with identical content. `npm run check` clean on the merge (25 files, 253 tests). Nothing else on that branch.
2. REQ-005 PO decisions and evidence review on `req-005-generator` (merged with `main`, commit 270c4a6): money-and-property and the new support-planning-and-transitions procedures in the core set; feedback-and-engagement procedure narrowed; `restrictive-practices` register with `when.modulesAny: ["ibsp"]` honoured by the content schema and `deriveDocumentSet` and tested; three evidence additions; every evidence item `draft: false`, `reviewedBy: "po"`, `reviewedAt: "2026-10-12"` through `meta.evidenceReview` (schema and build script updated); dataset **1.1.0** (186 items), `SOURCES.md` changelog, `standards:verify` green, Commission text unchanged.
3. REQ-005 Session A (commit 8625329): closed-block section schema, provider facts, catalogue access, document model with numbered sections and fixed house-style text for every outline, `docx` renderer (headings, numbered steps, tables, callouts, header and "Prepared with Readyline" footer), in-repo Flesch-Kincaid readability, terminology and claims lint wired to the house-style lists with class names exempt, house style constant pinned to the markdown, three reference cases, structure snapshots per case, docx structure checks, and the `docx-render` CI job (LibreOffice headless conversion of every skeleton, artifact upload; also on manual dispatch). Local: 71 skeleton `.docx` files across the three cases; check clean (28 files, 282 tests). LibreOffice itself is not on the dev machine; its first run is the CI job. D-506 to D-511.
4. REQ-005 Session B preparation (commit 2cb4cfd): strict context pack with a Proxy-traced exclusion test (services note and step-5 answers never read; canary absent from pack and prompts), versioned prompts (`2026-10-12.1`) with the house style verbatim and delimited data blocks, replay-fixture harness (replay by default, record only with `GENERATION_RECORD=1` and a key, `MissingFixtureError` with the expected path), validate-retry-fallback pipeline, red-team fixture and tests, recorder test and `npm run generation:record`. **Waiting for Anthropic key:** `.env.local` has no `ANTHROPIC_API_KEY` or `ANTHROPIC_MODEL`, so no real generation was recorded and there is no cost note; stopped after the harness as instructed (D-515). Check clean (32 files, 299 tests, 1 skipped recorder). D-512 to D-515.
5. STOP.

For Haider: `ANTHROPIC_API_KEY` (console key in a workspace with a monthly spend cap) and `ANTHROPIC_MODEL` into `.env.local`; then Dev records the first fixtures. PRs still to open by the PO: `req-004-migrate-dburl` and `req-005-generator`. Waiting for the PO.
