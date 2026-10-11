---
name: release-gate
description: Pre-ship gate that runs every role's checklist (front-end, back-end, QA, design, security, product, product owner) against a branch, phase or release before it merges to main or goes live, producing a single pass/fail report with evidence links. Use this whenever work is about to be merged, deployed or marked done, when a phase is closing, before a launch, or when someone asks "are we ready to ship", "can this go live", "final check" or "release review".
---

# Release gate

Nothing merges to `main` or reaches production without this gate. It exists so that the standards in the role skills are applied every time, not only when someone remembers. The output is one report that the product owner can accept or reject in minutes.

## How to run it

1. Identify the scope: branch, REQ ids, phase, or release tag. List the files changed (`git diff --stat main...HEAD`).
2. Read the REQ(s) and their Delivery evidence sections.
3. Run the automated checks and keep the output:
   - `npm run check` (lint, format, typecheck, unit)
   - `npm run build`
   - `npm run test:e2e` (both Playwright projects)
   - `npm audit --omit=dev --audit-level=high`
   - secret scan (gitleaks) if configured
   - claims checker over new copy and any generated document fixtures
   - accessibility scan (axe) on new pages, both projects, once added
4. Walk the role checklists below; for each line record pass, fail or not applicable with a link or file reference as evidence.
5. Write the report (template at the end) into the REQ under Delivery evidence or into `product/releases/<date>-<scope>.md` for a phase or launch.
6. Verdict: `Ready` only if every applicable line passes; otherwise `Not ready` with the numbered blockers. Nice-to-haves go to the backlog, not into the blockers list.

## Checklists (abridged; the role skills hold the detail)

**Product and scope (`product-owner`, `product-manager`)**

- [ ] Every AC in scope has a passing test or a manual record
- [ ] Nothing shipped outside the REQ scope; `CLAUDE.md` constraints intact
- [ ] Pricing, refund and cancellation wording honest and visible where relevant
- [ ] `DECISIONS.md` updated; `UNVERIFIED` register current; open decisions for Haider listed
- [ ] Backlog and REQ statuses updated

**Domain accuracy**

- [ ] Any regulatory statement cites a Commission source with date; two spot-checked against the live site
- [ ] Standards data hashes match `data/sources/manifest.json`
- [ ] Primer and content reflect Commission changes noticed since the last gate

**Front end (`frontend-dev`, `ui-ux-designer`)**

- [ ] 360px and desktop screenshots of every new state; no horizontal overflow
- [ ] Keyboard-only and screen-reader pass noted; axe zero serious or critical; Lighthouse accessibility 95+, performance 90+ on new pages
- [ ] All states present (loading, empty, error, success, locked, past due)
- [ ] `{{BRAND}}` only; notices where documents appear; AU spelling; claims checker green
- [ ] No new external origins, scripts or trackers; no new dependency without justification

**Back end (`backend-dev`)**

- [ ] zod `.strict()` at every boundary; length caps
- [ ] RLS on every tenant table; cross-tenant test green
- [ ] Secrets only server-side; `.env.example` current
- [ ] Webhook signature and idempotency tests (payments)
- [ ] Generation validated, claims-checked, tailoring-checked and logged (AI)
- [ ] Migrations forward-only and reviewed; purge and export paths tested where applicable

**Security and privacy (`cyber-security`)**

- [ ] Threat-model block present for the change
- [ ] Headers and CSP tests green; no CSP violations in the smoke journey
- [ ] Rate limits present on the new entry points
- [ ] Participant-data warning and detector on any new free-text field; field excluded from prompts, emails and logs
- [ ] Dependency audit and secret scan clean
- [ ] Phase-gate evidence from the threat model collected

**Quality (`qa`)**

- [ ] Tests assert behaviour and can fail; snapshots reviewed
- [ ] Negative and edge cases executed; flaky or quarantined tests: none, or linked with owner and date
- [ ] CI green on the branch; unit under 10 seconds, e2e under 5 minutes

**Operations (for deploys and launches)**

- [ ] Environment variables set in Vercel and Supabase for the target environment; region is Sydney
- [ ] Backups enabled; last restore drill date within the policy
- [ ] Error tracking, uptime and spend alerts active
- [ ] Rollback path known (previous deployment, migration reversibility noted)
- [ ] Support contact and status channel ready; legal pages live (terms, privacy, refunds, AI disclosure)

## Report template

```
# Release gate: <scope> (<date>)
Verdict: Ready | Not ready
Scope: <branch, REQs, files changed summary>

## Automated checks
| Check | Result | Evidence |
| --- | --- | --- |
| npm run check | pass | <log excerpt or CI link> |
| build | pass | |
| e2e (desktop, android-small) | pass | |
| audit (prod deps, high) | pass | |
| secret scan | pass | |
| claims checker | pass | |
| axe (new pages) | pass | |

## Role checklists
<each line: pass / fail / n.a. with evidence>

## Blockers (numbered, each tied to a checklist line or AC)

## Deferred to backlog (not blocking)

## Residual risks and who accepted them
```

Related skills: all role skills; this gate does not replace them, it checks that they were applied.
