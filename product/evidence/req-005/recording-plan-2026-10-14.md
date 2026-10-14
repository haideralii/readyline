# Recording plan for Haider's next model session (dry run, 2026-10-14)

Model claude-sonnet-5-5 at $2 in / $10 out per million tokens (cache write 1.25x, read 0.1x); prompt version 2026-10-14.2; fixtures in `fixtures/generation`. No model call was made to produce this.

Estimates: input tokens are characters over four; the system prompt and the document block are written to the cache once per document and read for its other sections (D-046); output tokens are the live fixture's, or 650 where there is none, capped at the section's cap. A validation retry or a truncation re-run adds a call; the recorder's report averages 1.24 attempts per section, so allow about 24 percent on top.

**Total if every group is recorded: 81 calls, about $0.66 cached ($0.91 uncached); 206,879 input and 49,854 output tokens.** Settled sections (nothing to do): 5.

## Fixture keys today

Approved sections 86; with a live fixture 83; missing 3; orphan files under older keys 85 (kept as history, D-502).

| Document | Approved | Live | Missing | Orphan files |
| --- | ---: | ---: | ---: | ---: |
| incident-management-policy-and-register | 6 | 6 | 0 | 25 |
| behaviour-support-plan-implementation-procedure | 3 | 3 | 0 | 4 |
| complaints-management-policy-and-register | 7 | 6 | 1 | 20 |
| practice-standards-self-assessment | 2 | 2 | 0 | 4 |
| governance-policy | 6 | 6 | 0 | 4 |
| risk-management-policy-and-register | 6 | 6 | 0 | 0 |
| continuity-of-supports-plan | 6 | 6 | 0 | 4 |
| conflict-of-interest-policy | 5 | 5 | 0 | 4 |
| privacy-and-information-management-policy | 5 | 5 | 0 | 3 |
| records-management-policy | 6 | 6 | 0 | 5 |
| worker-screening-and-recruitment-procedure | 5 | 5 | 0 | 2 |
| induction-and-training-procedure-and-register | 5 | 5 | 0 | 1 |
| code-of-conduct-acknowledgement | 2 | 2 | 0 | 0 |
| service-agreement-template | 4 | 3 | 1 | 1 |
| participant-rights-and-choice-policy | 7 | 6 | 1 | 2 |
| safeguarding-policy | 6 | 6 | 0 | 4 |
| emergency-and-disaster-management-plan | 5 | 5 | 0 | 2 |

## Group 0: Sections with no fixture for the current prompt

Replay has nothing to serve, so the pack shows the generic fallback for these sections until they are recorded once.

Command (the Anthropic variables come from `.env.local`): `GENERATION_RECORD=1 GENERATION_RECORD_GROUP=0 npm run generation:record`

3 call(s), about $0.03 cached ($0.03 uncached).

| Case | Document / section | Live fixture | Why | In | Out | $ cached |
| --- | --- | --- | --- | ---: | ---: | ---: |
| verification-sole-trader | complaints-management-policy-and-register/plain-language-summary | none | no fixture for the current prompt; one of the first three sections (finding 12) | 2572 | 650 | 0.007 |
| verification-sole-trader | service-agreement-template/plain-language-summary | none | no fixture for the current prompt; one of the first three sections (finding 12) | 2373 | 650 | 0.012 |
| verification-sole-trader | participant-rights-and-choice-policy/plain-language-summary | none | no fixture for the current prompt; one of the first three sections (finding 12) | 2397 | 650 | 0.012 |

## Group 1: The complaints procedure

Finding 9 (D-546): the recorded reply quotes Commission numbers from memory; the new brief refers to the fixed contact block and the contact-details lint rejects any number or address.

Command (the Anthropic variables come from `.env.local`): `GENERATION_RECORD=1 GENERATION_RECORD_GROUP=1 npm run generation:record`

1 call(s), about $0.01 cached ($0.02 uncached).

| Case | Document / section | Live fixture | Why | In | Out | $ cached |
| --- | --- | --- | --- | ---: | ---: | ---: |
| verification-sole-trader | complaints-management-policy-and-register/procedure | 2026-10-14.2 (re-keyed) | the complaints procedure (finding 9); brief changed in batch 40 (D-545); placeholder instructions in the reply (D-542); 5 version 2 lint finding(s) | 2766 | 1195 | 0.013 |

## Group 2: The first three tailored sections of every document

Finding 12: Purpose, Scope and the policy statement read at Year 10 to 11 against the Year 8 target; an auditor skims the front of each document first.

Command (the Anthropic variables come from `.env.local`): `GENERATION_RECORD=1 GENERATION_RECORD_GROUP=2 npm run generation:record`

44 call(s), about $0.33 cached ($0.44 uncached).

| Case | Document / section | Live fixture | Why | In | Out | $ cached |
| --- | --- | --- | --- | ---: | ---: | ---: |
| verification-sole-trader | incident-management-policy-and-register/policy-statement | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12) | 2520 | 482 | 0.011 |
| verification-sole-trader | incident-management-policy-and-register/purpose | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12) | 2514 | 89 | 0.002 |
| verification-sole-trader | incident-management-policy-and-register/scope | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12) | 2509 | 486 | 0.005 |
| behaviour-support-company | behaviour-support-plan-implementation-procedure/steps-getting-the-plan | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12) | 3769 | 836 | 0.018 |
| verification-sole-trader | complaints-management-policy-and-register/purpose | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12) | 2533 | 96 | 0.007 |
| verification-sole-trader | complaints-management-policy-and-register/scope | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12); placeholder instructions in the reply (D-542) | 2528 | 516 | 0.006 |
| verification-sole-trader | practice-standards-self-assessment/summary | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12); placeholder instructions in the reply (D-542) | 3139 | 483 | 0.013 |
| verification-sole-trader | practice-standards-self-assessment/how-we-meet | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12); placeholder instructions in the reply (D-542); 1 version 2 lint finding(s) | 3168 | 784 | 0.009 |
| verification-sole-trader | governance-policy/purpose | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12) | 2388 | 97 | 0.007 |
| verification-sole-trader | governance-policy/scope | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12) | 2356 | 535 | 0.006 |
| verification-sole-trader | governance-policy/policy-statement | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12) | 2479 | 588 | 0.007 |
| verification-sole-trader | risk-management-policy-and-register/purpose | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12); 1 version 2 lint finding(s) | 2592 | 96 | 0.007 |
| verification-sole-trader | risk-management-policy-and-register/scope | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12); 2 version 2 lint finding(s) | 2587 | 533 | 0.006 |
| verification-sole-trader | risk-management-policy-and-register/policy-statement | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12); 2 version 2 lint finding(s) | 2598 | 641 | 0.007 |
| verification-sole-trader | continuity-of-supports-plan/purpose | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12) | 2379 | 118 | 0.007 |
| verification-sole-trader | continuity-of-supports-plan/context | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12); placeholder instructions in the reply (D-542) | 2358 | 483 | 0.005 |
| verification-sole-trader | continuity-of-supports-plan/risks-and-scenarios | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12); placeholder instructions in the reply (D-542); 1 version 2 lint finding(s) | 2349 | 826 | 0.009 |
| verification-sole-trader | conflict-of-interest-policy/purpose | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12) | 2376 | 103 | 0.007 |
| verification-sole-trader | conflict-of-interest-policy/scope | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12) | 2344 | 529 | 0.006 |
| verification-sole-trader | conflict-of-interest-policy/policy-statement | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12) | 2498 | 707 | 0.008 |
| verification-sole-trader | privacy-and-information-management-policy/purpose | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12) | 2392 | 138 | 0.007 |
| verification-sole-trader | privacy-and-information-management-policy/scope | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12) | 2349 | 516 | 0.006 |
| verification-sole-trader | privacy-and-information-management-policy/policy-statement | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12) | 2428 | 740 | 0.008 |
| verification-sole-trader | records-management-policy/purpose | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12) | 2388 | 116 | 0.007 |
| verification-sole-trader | records-management-policy/scope | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12) | 2352 | 491 | 0.005 |
| verification-sole-trader | records-management-policy/policy-statement | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12); 2 version 2 lint finding(s) | 2424 | 868 | 0.009 |
| verification-sole-trader | worker-screening-and-recruitment-procedure/purpose | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12) | 2591 | 107 | 0.007 |
| verification-sole-trader | worker-screening-and-recruitment-procedure/when-this-applies | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12); placeholder instructions in the reply (D-542); 1 version 2 lint finding(s) | 2592 | 531 | 0.006 |
| verification-sole-trader | worker-screening-and-recruitment-procedure/steps | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12); placeholder instructions in the reply (D-542); 6 version 2 lint finding(s) | 2629 | 1096 | 0.012 |
| verification-sole-trader | induction-and-training-procedure-and-register/purpose | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12) | 2564 | 101 | 0.007 |
| verification-sole-trader | induction-and-training-procedure-and-register/when-this-applies | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12) | 2565 | 545 | 0.006 |
| verification-sole-trader | induction-and-training-procedure-and-register/steps | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12); 3 version 2 lint finding(s) | 2602 | 1056 | 0.011 |
| verification-sole-trader | code-of-conduct-acknowledgement/introduction | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12) | 2554 | 437 | 0.011 |
| verification-sole-trader | code-of-conduct-acknowledgement/our-expectations | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12); placeholder instructions in the reply (D-542); 1 version 2 lint finding(s) | 2554 | 932 | 0.010 |
| verification-sole-trader | service-agreement-template/parties | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12); placeholder instructions in the reply (D-542) | 2327 | 418 | 0.005 |
| verification-sole-trader | service-agreement-template/body | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12); placeholder instructions in the reply (D-542) | 2331 | 1160 | 0.012 |
| verification-sole-trader | participant-rights-and-choice-policy/purpose | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12) | 2385 | 99 | 0.002 |
| verification-sole-trader | participant-rights-and-choice-policy/scope | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12) | 2353 | 496 | 0.006 |
| verification-sole-trader | safeguarding-policy/purpose | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12) | 2385 | 114 | 0.007 |
| verification-sole-trader | safeguarding-policy/scope | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12) | 2353 | 519 | 0.006 |
| verification-sole-trader | safeguarding-policy/policy-statement | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12) | 2421 | 682 | 0.008 |
| verification-sole-trader | emergency-and-disaster-management-plan/purpose | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12) | 2392 | 106 | 0.007 |
| verification-sole-trader | emergency-and-disaster-management-plan/context | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12); placeholder instructions in the reply (D-542) | 2364 | 510 | 0.006 |
| verification-sole-trader | emergency-and-disaster-management-plan/risks-and-scenarios | 2026-10-14.2 (re-keyed) | one of the first three sections (finding 12); placeholder instructions in the reply (D-542) | 2355 | 798 | 0.009 |

## Group 3: The sections whose briefs changed in batch 40

Finding 8 (D-545): the incident procedure, the risk areas, the risk-assessed roles and the support planning steps; the recorded steps still say "as soon as possible", which the vague-time lint rejects.

Command (the Anthropic variables come from `.env.local`): `GENERATION_RECORD=1 GENERATION_RECORD_GROUP=3 npm run generation:record`

3 call(s), about $0.02 cached ($0.04 uncached).

| Case | Document / section | Live fixture | Why | In | Out | $ cached |
| --- | --- | --- | --- | ---: | ---: | ---: |
| verification-sole-trader | incident-management-policy-and-register/procedure | 2026-10-14.2 (re-keyed) | brief changed in batch 40 (D-545); 1 version 2 lint finding(s) | 2687 | 757 | 0.009 |
| verification-sole-trader | risk-management-policy-and-register/risk-areas | 2026-10-14.2 (re-keyed) | brief changed in batch 40 (D-545) | 2658 | 850 | 0.009 |
| verification-sole-trader | worker-screening-and-recruitment-procedure/risk-assessed-roles | 2026-10-14.2 (re-keyed) | brief changed in batch 40 (D-545); placeholder instructions in the reply (D-542); 2 version 2 lint finding(s) | 2660 | 472 | 0.006 |

## Group 4: Recorded replies that carry "[Provider to complete: ...]" instructions

Finding 2 (D-542): re-recording under the blank rule (S-8) turns the instructions into blanks the Finish page can ask for.

Command (the Anthropic variables come from `.env.local`): `GENERATION_RECORD=1 GENERATION_RECORD_GROUP=4 npm run generation:record`

27 call(s), about $0.23 cached ($0.35 uncached).

| Case | Document / section | Live fixture | Why | In | Out | $ cached |
| --- | --- | --- | --- | ---: | ---: | ---: |
| verification-sole-trader | incident-management-policy-and-register/how-we-do-this | 2026-10-14.2 (re-keyed) | placeholder instructions in the reply (D-542) | 2603 | 805 | 0.009 |
| verification-sole-trader | incident-management-policy-and-register/responsibilities | 2026-10-14.2 (re-keyed) | placeholder instructions in the reply (D-542) | 2598 | 634 | 0.007 |
| behaviour-support-company | behaviour-support-plan-implementation-procedure/steps-putting-the-plan-into-practice | 2026-10-14.2 (re-keyed) | placeholder instructions in the reply (D-542); 2 version 2 lint finding(s) | 3775 | 750 | 0.009 |
| behaviour-support-company | behaviour-support-plan-implementation-procedure/steps-monitoring-reporting-and-review | 2026-10-14.2 (re-keyed) | placeholder instructions in the reply (D-542); 1 version 2 lint finding(s) | 3778 | 1007 | 0.011 |
| verification-sole-trader | complaints-management-policy-and-register/how-we-do-this | 2026-10-14.2 (re-keyed) | placeholder instructions in the reply (D-542) | 2622 | 710 | 0.008 |
| verification-sole-trader | governance-policy/responsibilities | 2026-10-14.2 (re-keyed) | placeholder instructions in the reply (D-542) | 2445 | 662 | 0.007 |
| verification-sole-trader | governance-policy/structure-and-delegations | 2026-10-14.2 (re-keyed) | placeholder instructions in the reply (D-542) | 2385 | 680 | 0.007 |
| verification-sole-trader | risk-management-policy-and-register/responsibilities | 2026-10-14.2 (re-keyed) | placeholder instructions in the reply (D-542); 5 version 2 lint finding(s) | 2676 | 910 | 0.010 |
| verification-sole-trader | continuity-of-supports-plan/actions | 2026-10-14.2 (re-keyed) | placeholder instructions in the reply (D-542) | 2339 | 996 | 0.011 |
| verification-sole-trader | continuity-of-supports-plan/responsibilities | 2026-10-14.2 (re-keyed) | placeholder instructions in the reply (D-542) | 2417 | 650 | 0.007 |
| verification-sole-trader | continuity-of-supports-plan/sole-trader-cover | 2026-10-14.2 (re-keyed) | placeholder instructions in the reply (D-542) | 2374 | 711 | 0.008 |
| verification-sole-trader | conflict-of-interest-policy/how-we-do-this | 2026-10-14.2 (re-keyed) | placeholder instructions in the reply (D-542) | 2438 | 847 | 0.009 |
| verification-sole-trader | privacy-and-information-management-policy/how-we-do-this | 2026-10-14.2 (re-keyed) | placeholder instructions in the reply (D-542) | 2443 | 709 | 0.008 |
| verification-sole-trader | privacy-and-information-management-policy/responsibilities | 2026-10-14.2 (re-keyed) | placeholder instructions in the reply (D-542) | 2438 | 552 | 0.006 |
| verification-sole-trader | records-management-policy/how-we-do-this | 2026-10-14.2 (re-keyed) | placeholder instructions in the reply (D-542); 1 version 2 lint finding(s) | 2446 | 760 | 0.008 |
| verification-sole-trader | records-management-policy/retention-schedule | 2026-10-14.2 (re-keyed) | placeholder instructions in the reply (D-542) | 3004 | 913 | 0.011 |
| verification-sole-trader | worker-screening-and-recruitment-procedure/responsibilities | 2026-10-14.2 (re-keyed) | placeholder instructions in the reply (D-542); 1 version 2 lint finding(s) | 2660 | 774 | 0.009 |
| verification-sole-trader | induction-and-training-procedure-and-register/responsibilities | 2026-10-14.2 (re-keyed) | placeholder instructions in the reply (D-542); 1 version 2 lint finding(s) | 2633 | 675 | 0.008 |
| verification-sole-trader | induction-and-training-procedure-and-register/training-matrix | 2026-10-14.2 (re-keyed) | placeholder instructions in the reply (D-542); 1 version 2 lint finding(s) | 3230 | 720 | 0.009 |
| verification-sole-trader | service-agreement-template/easy-read-summary | 2026-10-14.2 (re-keyed) | placeholder instructions in the reply (D-542); 1 version 2 lint finding(s) | 2346 | 889 | 0.010 |
| verification-sole-trader | participant-rights-and-choice-policy/how-we-do-this | 2026-10-14.2 (re-keyed) | placeholder instructions in the reply (D-542) | 2447 | 724 | 0.008 |
| verification-sole-trader | participant-rights-and-choice-policy/communication | 2026-10-14.2 (re-keyed) | placeholder instructions in the reply (D-542); 1 version 2 lint finding(s) | 2376 | 860 | 0.009 |
| verification-sole-trader | safeguarding-policy/how-we-do-this | 2026-10-14.2 (re-keyed) | placeholder instructions in the reply (D-542); 1 version 2 lint finding(s) | 2447 | 736 | 0.008 |
| verification-sole-trader | safeguarding-policy/responsibilities | 2026-10-14.2 (re-keyed) | placeholder instructions in the reply (D-542); 1 version 2 lint finding(s) | 2442 | 646 | 0.007 |
| verification-sole-trader | safeguarding-policy/responding | 2026-10-14.2 (re-keyed) | placeholder instructions in the reply (D-542) | 2361 | 850 | 0.009 |
| verification-sole-trader | emergency-and-disaster-management-plan/actions | 2026-10-14.2 (re-keyed) | placeholder instructions in the reply (D-542) | 2345 | 1192 | 0.013 |
| verification-sole-trader | emergency-and-disaster-management-plan/responsibilities | 2026-10-14.2 (re-keyed) | placeholder instructions in the reply (D-542); 1 version 2 lint finding(s) | 2423 | 614 | 0.007 |

## Group 5: Recorded replies the version 2 lints flag

Finding 10 and the lint report (LINT_V2_REPORT=1): indicator restatement, vague time, staff as actor, record names, contact details.

Command (the Anthropic variables come from `.env.local`): `GENERATION_RECORD=1 GENERATION_RECORD_GROUP=5 npm run generation:record`

3 call(s), about $0.02 cached ($0.04 uncached).

| Case | Document / section | Live fixture | Why | In | Out | $ cached |
| --- | --- | --- | --- | ---: | ---: | ---: |
| verification-sole-trader | complaints-management-policy-and-register/policy-statement | 2026-10-14.2 (re-keyed) | 2 version 2 lint finding(s) | 2539 | 571 | 0.006 |
| verification-sole-trader | risk-management-policy-and-register/how-we-do-this | 2026-10-14.2 (re-keyed) | 1 version 2 lint finding(s) | 2681 | 786 | 0.009 |
| verification-sole-trader | participant-rights-and-choice-policy/policy-statement | 2026-10-14.2 (re-keyed) | 1 version 2 lint finding(s) | 2421 | 693 | 0.008 |

## Settled sections

- verification-sole-trader: complaints-management-policy-and-register/responsibilities
- verification-sole-trader: governance-policy/how-we-do-this
- verification-sole-trader: conflict-of-interest-policy/responsibilities
- verification-sole-trader: records-management-policy/responsibilities
- verification-sole-trader: participant-rights-and-choice-policy/responsibilities
