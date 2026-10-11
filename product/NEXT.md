# NEXT: the dev work queue

The PO maintains this file. Dev works through the items **in order**, one at a time, and after each item: runs `npm run check` and `npm run build`, commits with a message that names the REQ, pushes to the named branch, and fills in the REQ's **Delivery evidence** (or **Dev response**) section. Do not skip ahead if an item is blocked; write the blocker under the item and move to the next item only if it does not depend on the blocked one. When you reach STOP, finish by appending a short status summary at the bottom of this file under "Dev status" and stop.

Rules that always apply: `CLAUDE.md` section 4, the threat model, the definition of done, and the primer. Never touch `product/requirements/*.md` outside the Dev response and Delivery evidence sections. Never mark a REQ accepted.

## Queue (written by PO, 11 Oct 2026)

1. **REQ-001 Session B** on branch `req-001-standards-mapping` (PR #1 is open as draft; CI runs on every push). Deliver `deriveApplicability` with inputs `{ groups, businessStructure, usesRestrictivePractices, silEligibility }`, returning modules, pathway, `midTermAudit`, and `reasons[]` with rule and source ids; the `standards:report` script printing the evidence disclaimer and draft flags; the AC-6 drift demonstration; the five items in the PO's Session A review (changelog count, README refresh procedure, etc.); tests for AC-2, AC-3, AC-7, AC-10. Fill Delivery evidence with the CI link. Then STOP for this branch (PO will review and mark the PR ready).

2. **REQ-002 build** on a new branch `req-002-security-baseline` from `main`. Follow the PO review in the REQ: one-hour spike on hash-based CSP with Cache Components, fall back to nonce CSP via `proxy.ts` with Cache Components off; gitleaks Action with a path-scoped allow-list for `data/sources/**`; `npm audit` gate; `.env` commit check; logging redactor; env fail-fast; `SECURITY.md`; PR template. Open a draft PR titled "REQ-002: security baseline" (use `gh pr create --draft` if `gh` is authenticated, otherwise leave a note and the PO will open it). Fill Delivery evidence with the CI link and the header dump. Expect this branch to conflict trivially with REQ-001 on `DECISIONS.md`; resolve by keeping both entries.

3. **REQ-003 Dev response only**, on branch `req-003-questionnaire` from `main`: answer the four questions in the REQ (schema proposal, where group descriptions live, form-state approach, estimate). Draft the 38 plain-English group descriptions in a data file marked as ours, for PO review. Do not build the UI yet; Phase 2 opens when Phase 1 REQs are accepted.

4. STOP. Append your status below and wait for the PO.

## Dev status

(Dev appends here.)

## Dev status

**2026-10-11, Dev (Claude Code session), all queue items done to STOP.**

1. REQ-001 Session B: done and pushed to `req-001-standards-mapping` (commit `207aa32`; PR #1). `deriveApplicability` with `silEligibility`, `reasons[]` (rule and source ids) and `midTermAudit`; `standards:report` printing the evidence disclaimer and `[draft]` markers; SOURCES.md Contents section replaces the changelog count; refresh procedure in `data/README.md`; AC-6 drift demonstration recorded; tests for AC-2, AC-3, AC-7, AC-10 (121 tests). Delivery evidence filled with the PR and Actions links. Decisions D-119 to D-121. One `UNVERIFIED` added: whether restrictive-practice use changes a verification audit into certification.
2. REQ-002: done and pushed to `req-002-security-baseline` (commit `1cd66e5`, branched from `main`). The hash-based CSP spike failed as predicted (11 inline bootstrap scripts blocked, no hydration); nonce CSP via `src/proxy.ts` with Cache Components off and `connection()` in the root layout is in. All headers asserted by e2e on both projects with zero CSP violations; audit gate, gitleaks job, `.env` commit check, logging redactor and `no-console`, env fail-fast, validation convention with a guard test, SECURITY.md, PR template. Decisions D-201 to D-208. **Blocker for the PO:** `gh` is not installed on the dev machine, so no draft PR was opened; please open "REQ-002: security baseline" from the pushed branch. AC-1 and AC-2 "throwaway commit" demonstrations need a deliberately bad push and were left for the PO to trigger or witness.
3. REQ-003: Dev response written and pushed to `req-003-questionnaire` (branched from `main`, with REQ-003 and this file brought across from the PO's commit because `main` does not carry them). Schema proposal and step-to-field map, 38 draft group descriptions in `data/registration-group-descriptions.json` (marked as ours, with tests), form-state recommendation (client-held answers, DraftStore, one `deriveResult` server action), three-session estimate. No UI built.

Notes: `main` is behind the REQ-001 branch (PO commits, skills, NEXT.md live there), so REQ-002 and REQ-003 will conflict trivially with REQ-001 on `DECISIONS.md`, `.prettierignore` (identical additions) and the REQ files' Dev/PO sections; keep both sides. Local development now requires `.env.local` with `NEXT_PUBLIC_SITE_URL` once REQ-002 merges. Waiting for the PO.