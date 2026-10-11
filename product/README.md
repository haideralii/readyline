# Product folder: how this project is run

Two roles, one repo.

- **Product owner (PO)**: the Claude session in the Cowork app, acting as client, project manager, QA lead, security reviewer and NDIS domain lead. Writes requirements, reviews delivered work, keeps the backlog and the domain knowledge current. Does not write application code.
- **Dev / solution architect (Dev)**: the Claude session in Cursor. Designs and builds from the requirement packages, proposes architecture, raises questions and risks, delivers with evidence.

Haider owns every decision that costs money, touches legal or brand, or changes scope. Both roles record assumptions in `DECISIONS.md`.

## The loop

1. PO writes a requirement package `product/requirements/REQ-nnn-*.md` using the template below and adds it to `product/backlog.md`.
2. Dev reads `CLAUDE.md`, `DECISIONS.md`, `product/domain/*`, `product/security/*`, then the REQ. Before coding, Dev replies in `product/requirements/REQ-nnn-*.md` under **Dev response**: approach, open questions, risks, estimate in sessions.
3. Dev builds on a branch named after the REQ, with tests, and fills **Delivery evidence** in the REQ: what was built, test output, screenshots at 360px and desktop where UI exists, security checklist results, anything `UNVERIFIED`.
4. PO reviews against the acceptance criteria and `product/qa/review-checklist.md`, writes **PO review** (accepted / changes requested with numbered items). Only the PO marks a REQ done.
5. Phase gates: no phase starts until every REQ in the previous phase is accepted, except where the PO explicitly allows parallel work.

## Requirement package template

```
# REQ-nnn: <title>
Status: draft | ready | in progress | in review | accepted
Phase: n   Priority: must | should | could   Owner: Dev
## Why (user and business outcome)
## Scope (in / out)
## Domain rules that apply (link to product/domain)
## Functional requirements (numbered FR-1 ...)
## Security and privacy requirements (numbered SR-1 ...)
## Data (entities, fields, retention)
## Acceptance criteria (Given/When/Then, numbered AC-1 ...)
## Test expectations (unit, integration, e2e, manual)
## Evidence required on delivery
## Questions for Dev to answer before building
## Dev response
## Delivery evidence
## PO review
```

## The work queue (`product/NEXT.md`)

To reduce hand-offs, the PO keeps an ordered queue in `product/NEXT.md`. Haider starts a Cursor session with "Work through product/NEXT.md in order, pushing after each item, until it says STOP." Dev works the queue, pushes each item to its branch (CI runs on the PR), fills in the REQ evidence, and appends a status at the bottom of `NEXT.md`. The PO then reviews everything in one batch, writes the next queue, and Haider says "go" again. Only the PO edits the queue; Dev edits only the "Dev status" section.

## PO git hygiene (after the batch-5 incident, D-035)

The working tree is shared with Dev and the PO's shell cannot delete files, so a branch checkout can leave another branch's files on disk. Rules for the PO: never run `git checkout` of a branch in the shared tree (read other branches with `git show <branch>:<path>`); never `git add -A`; stage only explicit paths under `product/`, `DECISIONS.md`, `CLAUDE.md`, `.gitignore`; run `git status --short` before every commit and abort if anything outside those paths is staged or modified.

## Communication rules

- Dev never guesses regulatory content; anything not from a primary source is tagged `UNVERIFIED` and listed in the REQ.
- Dev asks questions as options with a recommendation, so Haider can answer in one line.
- PO asks for evidence, not assurances: diffs, test output, screenshots, logs.
- Prohibited-claims, brand and privacy rules in `CLAUDE.md` section 4 override anything in a REQ.
