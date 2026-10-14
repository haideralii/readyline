---
name: role-review-pipeline
description: Seven-role sanity-testing pipeline for Readyline, run in order (QA, manager, field specialist, NDIS domain expert, NDIS provider, NDIS auditor, NDIS Commission), each role in its own skill with its own lens, findings kept separate per role under product/qa/role-reviews/<date>/. Use this whenever asked to sanity test, review a release, review the documents or a generated pack, do a persona review, "test as a provider", "review as an auditor", or before a phase gate or a trial.
---

# Role review pipeline

One release, seven pairs of eyes, one after the other. Each role is a separate skill with a different job, vocabulary and pass mark. Findings never mix: one file per role per run, so the PO can see which lens caught what and which lens found nothing (that is also a finding).

## Order and why

1. `qa`: does it work, is it tested, is CI green (the floor).
2. `product-manager`: does the path make sense, does it match the REQs, what is missing or half-built (the plan).
3. `field-specialist`: a support worker or team leader who must act on these documents on shift (the hands).
4. `ndis-domain-expert`: the rules, time frames, legal wording, states and modules, every sentence checked against the Commission and legislation (the law).
5. `ndis-provider`: the owner of a small provider, non-technical, in a hurry, paying with their own money (the customer).
6. `ndis-auditor`: the approved quality auditor at a desk with one pack and then on site (the judge).
7. `ndis-commission`: the regulator: registration conditions, Code of Conduct, notifications, what it would act on (the referee).

Later roles only start after the earlier ones have written their file; a role may read earlier findings but must not copy them, and must say when it disagrees.

## What every role reviews

The same artefacts, in this order: the rendered sole-trader evidence pack (`product/evidence/req-005/sole-trader/*.docx`, or a fresh render), one generated pack from a real test account on the target environment, the live journey on a phone (home, questionnaire, result, buy, documents, finish, adopt, checklist, registers, audit day) and the registers with at least one row entered. Official sources lead: where a role's expectation and a Commission document differ, the document wins and the finding says so.

## Finding format (identical for every role)

`product/qa/role-reviews/YYYY-MM-DD/<role>.md`, headed with the environment, SHA, device, and the account used. Then a numbered list; every finding has: where (page or document and section), what was seen (quote the words), what this role expected and why (cite the source for domain roles), severity in this role's own scale (defined in each skill), and a one-line proposed fix. End with "Nothing found in:" listing what was checked and clean. No code changes during a review; the PO turns findings into a batch.

## Severity scales (so roles do not argue)

qa and manager: blocker / major / minor. Field specialist and provider: "I could not do my job" / "I would get it wrong" / "annoying". Domain expert: wrong (contradicts an official source) / unsourced / imprecise. Auditor: major non-conformity / minor non-conformity / observation. Commission: would act / would ask / would note.

## After the run

The PO reads the seven files, dedupes across roles, and writes one batch in `product/NEXT.md` with the role tags kept on each item so the fix can be checked by the same lens. The run date, SHA and counts per role go into `product/qa/role-reviews/README.md`.
