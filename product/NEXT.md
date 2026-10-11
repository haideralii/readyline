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

## Dev status

(Dev appends here.)

**2026-10-11 (later), Dev: batch 2 worked to STOP; item 3 blocked behind item 2's merge.**

0. Readyline brand default: done on `req-001-standards-mapping` (`301d3e1`): `BRAND_DEFAULT = "Readyline"` with `NEXT_PUBLIC_BRAND_NAME` as override, tests updated (`isBrandNameAllowed("Readyline")`), `.env.example` and README updated, `evidenceDisclaimer` regenerated so the dataset and report print "Readyline"; D-027 recorded.
1. REQ-001 merge: PR #1 was already merged on GitHub (`39fd178`). On Haider's instruction the branch (PO batch 2, item 0, and the Session B note commit `d0f9080` tagging the early-childhood-plus-verification case `unverified`, register D-122) was merged into `main` with `--no-ff` as `1232a73` and pushed; merge recorded in REQ-001 (`ae149f7`). CI was not re-confirmed from the dev machine (no `gh`, no API token; the unauthenticated Actions API returns 404). **The remote branch `req-001-standards-mapping` was not deleted: the command was blocked by the tool's safety check; please delete it or tell Dev to retry.**
2. REQ-002: `permissions: contents: read, pull-requests: read` added to the Secret scan job; rebased onto the new `main`; conflicts in `.env.example`, `.prettierignore`, `DECISIONS.md`, `package.json` and the REQ file resolved keeping both sides; pushed as `543a030` (+ evidence note `f716fb9`). Local on that commit: check clean (157 tests), verify ok, audit 0, env-file check ok, dynamic build, e2e 8 passed on the production server. **Blocked at the merge step:** the PO's condition is both CI jobs green on the latest commit and Dev cannot read CI status from this machine. If the run for `f716fb9` is green, say "merge REQ-002" and Dev will merge per the rule, or merge it directly.
3. REQ-003 build: not started; blocked because the PO's approval is "once PR #1 and PR #2 are merged" and item 2 is not merged. Ready to start immediately after (rebase `req-003-questionnaire` onto `main`, descriptions to `reviewed`, `data/readyline-content/*.json` with tests, strip `servicesNote`, then Sessions A to C).
4. REQ-004 Dev response: done on `req-004-accounts` (`2c5f6de`, from `main`): CI Supabase local-stack job layout within budget, our own per-email and per-IP limiter in front of Supabase's built-in limits (custom SMTP needed before real traffic, pulls the D-013 email decision forward), Vercel Cron purge route recommended over pg_cron and Actions, three-session estimate, and the dashboard values Haider must copy listed by name only. Nothing provisioned.

Waiting for the PO.