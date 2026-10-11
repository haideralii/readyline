# NEXT: the dev work queue

The PO maintains this file. Dev works through the items **in order**, one at a time, and after each item: runs `npm run check` and `npm run build`, commits with a message that names the REQ, pushes to the named branch, and fills in the REQ's **Delivery evidence** (or **Dev response**) section. Do not skip ahead if an item is blocked; write the blocker under the item and move to the next item only if it does not depend on the blocked one. When you reach STOP, finish by appending a short status summary at the bottom of this file under "Dev status" and stop.

Rules that always apply: `CLAUDE.md` section 4, the threat model, the definition of done, and the primer. Never touch `product/requirements/*.md` outside the Dev response and Delivery evidence sections. Never mark a REQ accepted.

**Merge rule (new, 11 Oct 2026):** Dev may merge a PR into `main` only when (a) the REQ's PO review says Accepted (or Accepted conditionally with the named condition met) and (b) every CI job on the PR's latest commit is green. Merge with `git checkout main && git pull --ff-only && git merge --no-ff <branch> && git push origin main`, then delete the remote branch. Record the merge commit in the REQ's Delivery evidence. Anything else waits for the PO.

## Queue (written by PO, 11 Oct 2026, batch 2)

1. **Merge PR #1** (REQ-001, accepted). Apply the two non-blocking notes from the PO's Session B review first (tag the [0118 + verification group] partnership case `unverified`; keep the restrictive-practices note visible) in one small commit, confirm CI green, then merge per the merge rule.

2. **REQ-002 fix and merge** on `req-002-security-baseline`: add `permissions: { contents: read, pull-requests: read }` to the Secret scan job; rebase onto the new `main`; resolve conflicts keeping both sides; push; when both jobs are green, merge per the merge rule (the PO's conditional acceptance names exactly this condition).

3. **REQ-003 build** on `req-003-questionnaire`: rebase onto `main`; apply the PO review (descriptions to `status: "reviewed"`; create `data/readyline-content/modules.json`, `audit-types.json`, `document-sets.json` from the PO text with tests that every module and audit type has an entry; strip `servicesNote` before derivation with a test). Then Sessions A, B and C as estimated. Push after each session. Fill Delivery evidence with the CI link, screenshots at 360x740 and desktop for every step, Lighthouse accessibility scores, and the e2e report. Do not merge; the PO reviews UI.

4. **REQ-004 Dev response only** on `req-004-accounts` from `main`: answer the four questions. List, by name only, the values Haider must copy from the Supabase dashboard into `.env.local`. Do not provision anything.

5. STOP. Append your status below.

## Dev status

(Dev appends here.)
