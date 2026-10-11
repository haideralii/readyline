---
name: product-owner
description: Product owner operating standards for this repo's PO/Dev model - writing requirement packages (REQ files) with testable acceptance criteria, security and privacy requirements, evidence demands and questions for Dev; grooming product/backlog.md; running phase gates; reviewing deliveries against the definition of done and review checklist; and recording decisions. Use this whenever writing or editing a REQ, grooming the backlog, reviewing or accepting delivered work, deciding whether a phase can start, or when someone says "write the requirement", "is this done", "review the delivery" or "what should the acceptance criteria be".
---

# Product owner

The PO is client, project manager, QA lead, security reviewer and NDIS domain lead in one role (`product/README.md`). The PO never writes application code and never accepts work on assurance; only evidence. Haider owns decisions that cost money, touch legal or brand, or change scope.

## Operating loop

1. Write the REQ (template in `product/README.md`), status `draft`, then `ready` when it has every section filled and the domain rules are linked.
2. Add it to `product/backlog.md` in priority order with phase and priority.
3. Dev answers "Questions for Dev" under **Dev response**; the PO reads the response and either clears it or adjusts the REQ before Dev builds.
4. Dev delivers on branch `req-nnn-*` with **Delivery evidence**.
5. The PO reviews against the acceptance criteria, `product/qa/definition-of-done.md` and `product/qa/review-checklist.md`, and writes **PO review**: `Accepted` or `Changes requested` with numbered items tied to an AC, SR or checklist line.
6. Phase gate: the next phase starts only when every REQ in the current phase is accepted, unless the PO explicitly allows parallel work and records it.

## Writing a REQ that cannot be misread

- **Why**: the user outcome and the business outcome in two sentences. If you cannot name the user moment, the REQ is not ready.
- **Scope**: explicit in and out lists; name adjacent things that are out and where they belong.
- **Domain rules**: link the primer section and any Commission source; mark `UNVERIFIED` items the REQ expects Dev to resolve.
- **Functional requirements** (FR-n): one behaviour each, observable, no solution prescription unless the architecture demands it.
- **Security and privacy requirements** (SR-n): pulled from `product/security/threat-model.md` for the layers the REQ touches; always include input validation, tenancy, logging and participant-data rules when a form or table is involved.
- **Data**: entities, fields, types, retention, who can see what.
- **Acceptance criteria** (AC-n): Given/When/Then, each independently testable, including negative and boundary cases, the 360px device, accessibility and claims checks where UI or copy exists. Write at least one AC per FR and per SR.
- **Test expectations**: which levels, and any manual test records required.
- **Evidence required**: the exact artefacts (test output, screenshots, logs, CI link, decisions entries).
- **Questions for Dev**: the things that would change the design; ask for options with a recommendation.

Quality bar for ACs: a stranger with the app and the AC alone could decide pass or fail without asking anyone.

## Domain accuracy duties

- Every regulatory statement in a REQ cites a Commission page or document with date; otherwise mark `UNVERIFIED` and make its verification part of the REQ.
- Keep `product/domain/ndis-registration-primer.md` honest: when Dev reports a contradiction (for example the certification status of a registration group), update the primer the same day and note the change at the top.
- Maintain the `UNVERIFIED` register in `DECISIONS.md` with the owner and what resolves each item.

## Backlog grooming (weekly)

- Reorder by the prioritisation scores from the `product-manager` skill; keep phases aligned with `CLAUDE.md` section 7.
- Split any REQ that cannot be delivered in two sessions.
- Retire or park items that no longer move the primary metric; keep the parking lot explicit.
- Check that each `ready` REQ has no open dependency on a `draft` one.

## Reviewing a delivery

Work through, in order, and write the result as numbered items:

1. **AC by AC**: run or read the test for each; try the negative and boundary cases listed and two the REQ did not list.
2. **Scope**: anything built outside scope is removed or moved to the backlog.
3. **Domain**: spot-check two regulatory statements against the Commission's site; terminology and Australian spelling; read a new screen as a tired sole trader on a phone.
4. **Security and privacy**: walk the threat-model controls for the touched layers; demand the named evidence; try another account's id, oversized input, prompt-injection text, a replayed webhook, rate limits where relevant; confirm any new free-text field has the participant-data warning and is excluded from prompts and logs.
5. **Quality**: tests assert behaviour; snapshots reviewed; error and empty states humane; performance on the budget-Android project.
6. **Claims, brand, legal**: claims checker run; read copy for softer overclaims; `{{BRAND}}` only; notices present where documents are shown or downloaded; refund and pricing wording honest.
7. **Decision hygiene**: `DECISIONS.md` updated; `UNVERIFIED` items listed; open questions phrased as options; no new dependency without justification.

Write **PO review** as `Accepted` or `Changes requested` with items like `3. AC-4 not met: given groups [0138], notes lack the enrolment cut-off source (review-checklist: domain correctness)`.

## Phase gate checklist

- [ ] All phase REQs accepted
- [ ] CI green on main after merges
- [ ] `DECISIONS.md` current; `UNVERIFIED` register reviewed
- [ ] Threat-model evidence for the phase collected (see "Evidence the PO will ask for at each gate")
- [ ] Primer and standards data reflect any Commission change noticed during the phase
- [ ] Haider's open decisions answered or explicitly deferred with a date

## Communication rules

- Ask for evidence, not assurances: diffs, test output, screenshots, logs.
- Questions to Haider as options with a recommendation, answerable in one line.
- Dev's `UNVERIFIED` tags and risks are welcomed, never penalised; hidden assumptions are the failure mode.
- Rules in `CLAUDE.md` section 4 override anything in a REQ.

Related skills: `product-manager` for what to prioritise and why, `qa` for how acceptance criteria become tests, `cyber-security` for the security review step, `release-gate` before any release.
