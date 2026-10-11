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
