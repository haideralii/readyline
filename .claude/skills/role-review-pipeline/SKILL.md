---
name: role-review-pipeline
description: Nine-role sanity-testing pipeline for Readyline, run in order (QA, manager, field specialist, NDIS domain expert, NDIS provider, NDIS auditor, NDIS Commission, then the security tester on its weekly schedule and the lawyer with one pass per state), each role in its own skill with its own lens, findings kept separate per role under product/qa/role-reviews/<date>/. Use this whenever asked to sanity test, review a release, review the documents or a generated pack, do a persona review, "test as a provider", "review as an auditor", "review as a lawyer", "pen test" or "security review", or before a phase gate or a trial.
---

# Role review pipeline

One release, nine pairs of eyes, one after the other. Each role is a separate skill with a different job, vocabulary and pass mark. Findings never mix: one file per role per run, so the PO can see which lens caught what and which lens found nothing (that is also a finding).

## Order and why

1. `qa`: does it work, is it tested, is CI green (the floor).
2. `product-manager`: does the path make sense, does it match the REQs, what is missing or half-built (the plan).
3. `field-specialist`: a support worker or team leader who must act on these documents on shift (the hands).
4. `ndis-domain-expert`: the rules, time frames, legal wording, states and modules, every sentence checked against the Commission and legislation (the law).
5. `ndis-provider`: the owner of a small provider, non-technical, in a hurry, paying with their own money (the customer).
6. `ndis-auditor`: the approved quality auditor at a desk with one pack and then on site (the judge).
7. `ndis-commission`: the regulator: registration conditions, Code of Conduct, notifications, what it would act on (the referee).
8. `security-tester`: the attacker who is on our side (the lock-picker). On a schedule, not every run: once a week, or twice in a week that merged a change to auth, payments, RLS, the auditor link, the import or a route handler; otherwise it skips, and the README table says why in one line.
9. `lawyer`: an Australian lawyer reading as the provider's lawyer would, nationally and then once per state or territory the questionnaire offers (the fine print). Always last, on every run, because it reads every other file first.

Later roles only start after the earlier ones have written their file; a role may read earlier findings but must not copy them, and must say when it disagrees. The lawyer reads all seven earlier files before writing and says where it disagrees; the security tester works from a clean clone and names the SHA and every command it ran.

## Role 8: `security-tester`

Lens: OWASP ASVS level 2 for the parts that hold customer data and money, level 1 elsewhere; `product/security/threat-model.md`; REQ-002 and REQ-004's security requirements as the pass mark. Reads the code and the running site. Never runs an exploit, a scanner that writes, a brute force, or anything against the hosted Supabase project or Vercel that a free tier or their terms would call abuse (D-2207). Non-destructive checks are allowed from a clean clone against a local production build with the fake Stripe provider and the local Supabase stack: header and CSP review; auth and session flows (magic link, cross-device, the aal2 step, sign-out); RLS by reading every policy and running the integration suite; CSRF and origin checks; rate limits; input parsing on every route handler and server action (`strictObject`, length caps); the auditor link token (entropy, expiry, scope, revocation); the import path (file type, size, parser, what a hostile file does); the CSV and zip exports (formula injection, path names); email templates (header injection, link targets); secrets handling (no value in a page, log, test output or evidence file; gitleaks); dependency audit; the admin surfaces (404 for non-admins, the TOTP step); the cron routes' secret.

Scale: critical (exploitable now against a customer's data or money) / high (exploitable with a precondition we do not control) / medium (a defence missing, not exploitable alone) / low (hygiene). Every finding carries the ASVS requirement id, the file and line or the route, the reproduction as a test the Dev can add (never a working exploit against production), and the proposed fix. "Nothing found in" lists every ASVS chapter checked. File: `security-tester.md`; when the schedule says skip, no file, and the README row says why.

## Role 9: `lawyer`

Lens: the product's own legal pages (terms, privacy, refunds, AI statement, about) as a consumer contract under the Australian Consumer Law; the generated documents as the provider's own policies under the NDIS Act, the Rules and the Practice Standards; and, per state sub-role, the state law D-2211 lists. Not legal advice: the role writes questions and findings for the real lawyer in `product/legal/questions-for-the-lawyer.md` (REQ-022 FR-12), and nothing it says changes what the site claims about itself.

What is national and what differs by state (D-2211): registration, the Practice Standards, the audit, the Code of Conduct, the incident and complaints Rules and the Commission itself are one set in every state and territory. The edges differ: (1) worker screening, national in effect but applied for through each state or territory's screening unit with its own name, fee, portal and timing; (2) working with children checks, state schemes separate from the NDIS check, both required for some supports in some states; (3) restrictive practices, reported nationally but authorised through a state or territory process (NSW an authorisation panel and a central system, Victoria the Senior Practitioner, Queensland a positive behaviour support plan route with a state authority, WA its own framework, and so on); (4) health and personal information, the Privacy Act and the APPs plus the NSW, Victorian and ACT health records laws; (5) work health and safety, the harmonised model laws everywhere but Victoria; (6) mandatory reporting of abuse of children and, in some states, adults, in state law with different reporter lists; (7) business basics (ABN, GST), national. Sources: the Commission's worker screening and restrictive practices pages, each state's screening unit page, legislation.gov.au for the Rules; every state claim cites the page and the read date or is marked UNVERIFIED (CLAUDE.md: official documentation wins).

Sections of `lawyer.md`, in order: (a) national: ACL (misleading conduct, unfair contract terms in the terms of use, the refund promise against the consumer guarantees, the general-information disclaimer's limits), Privacy Act and APPs (collection notice, overseas disclosure, retention, access and correction, the small business exemption and why we do not rely on it), the Code of Conduct as it binds the provider, the NDIS Act sections the documents cite; (b) one sub-section per state or territory the questionnaire offers (NSW, VIC, QLD, WA, SA, TAS, ACT, NT), each checking the seven points above against every document and page that should name a state body, a state Act or a state process: the worker screening unit and the working with children check, restrictive practices authorisation, health records law, the WHS Act, mandatory reporting, and anything the state's own disability inclusion or safeguarding law adds (Victoria's and NSW's disability inclusion Acts, Queensland's Human Rights Act for public-facing providers).

Scale: wrong (contradicts the law or an official source; cite it) / missing (the law requires a statement or step that is absent) / unclear (a reader could take it two ways) / for the lawyer (a real question only a practising lawyer should answer). Each sub-role ends with "Nothing found in" for its seven points; the file ends with the consolidated list of questions that went into `questions-for-the-lawyer.md`. File: `lawyer.md`, one file, one section per sub-role.

## What every role reviews

The same artefacts, in this order: the rendered sole-trader evidence pack (`product/evidence/req-005/sole-trader/*.docx`, or a fresh render), one generated pack from a real test account on the target environment, the live journey on a phone (home, questionnaire, result, buy, documents, finish, adopt, checklist, registers, audit day) and the registers with at least one row entered. Official sources lead: where a role's expectation and a Commission document differ, the document wins and the finding says so.

## Finding format (identical for every role)

`product/qa/role-reviews/YYYY-MM-DD/<role>.md`, headed with the environment, SHA, device, and the account used. Then a numbered list; every finding has: where (page or document and section), what was seen (quote the words), what this role expected and why (cite the source for domain roles), severity in this role's own scale (defined in each skill), and a one-line proposed fix. End with "Nothing found in:" listing what was checked and clean. No code changes during a review; the PO turns findings into a batch.

## Severity scales (so roles do not argue)

qa and manager: blocker / major / minor. Field specialist and provider: "I could not do my job" / "I would get it wrong" / "annoying". Domain expert: wrong (contradicts an official source) / unsourced / imprecise. Auditor: major non-conformity / minor non-conformity / observation. Commission: would act / would ask / would note. Security tester: critical / high / medium / low. Lawyer: wrong / missing / unclear / for the lawyer.

## After the run

The PO reads the files (seven, eight or nine), dedupes across roles, and writes one batch in `product/NEXT.md` with the role tags kept on each item so the fix can be checked by the same lens. The run date, SHA and counts per role go into `product/qa/role-reviews/README.md`, the security and lawyer counts in their own two columns (a skipped security run says why in its cell). State coverage is reviewed against the questionnaire's state list, and any state the product cannot yet describe correctly becomes a REQ item rather than a silent gap.
