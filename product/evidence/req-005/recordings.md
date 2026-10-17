# REQ-005 recording tables (batches 10 to 17, 12 Oct 2026)

Where these came from: moved on 15 Oct 2026 from `product/requirements/REQ-005-document-generator.md` ("Delivery evidence", batches 10 to 17) under the PO's decision on the retro review of REQ-001 to REQ-005 (`product/qa/req-reviews/2026-10-15-retro-req-001-005.md`, finding 55). Every table is as it stood in the REQ, number for number and word for word; the REQ keeps one summary line where each table was. The prose around each table (spend to date, the reason for each outcome, the PO's reviews and budgets) stays in the REQ. Model `claude-sonnet-5-5` unless a row says otherwise; prices from D-037 ($2 in, $10 out per million tokens); from batch 16 the cached rates (cache writes at 1.25x and reads at 0.1x of the input rate). Retry first calls are not itemised by the recorder (it keeps the last call's tokens), so "(x2)" rows are counted at twice the last call, an upper bound.

## Batch 10 (2026-10-12): first recordings, one call per case (D-039)

| Case | Document / section | Estimated in | Actual in | Out | Dollars | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| verification-sole-trader | incident management policy / policy statement | 1,689 | 2,325 | 1,397 | 0.019 | passed first time; readability grade 8.5 |
| certification-personal-care | governance policy / purpose | 2,021 | 2,672 | 159 | 0.007 | passed first time; readability grade 11.8 (above the fail threshold; see note) |
| behaviour-support-company | behaviour support plan implementation / steps | 4,498 | 5,635 then 5,678 | 2,000 then 2,000 | 0.031 each | failed twice: the reply was cut at the 2,000-token output cap mid-JSON, so it never parsed; stopped per the queue, not re-recorded |

## Batch 11 (2026-10-12): one run of `npm run generation:record`, 7 calls, about $0.15

| Case / document / section | Cap | In | Out | Dollars | Outcome |
| --- | --- | --- | --- | --- | --- |
| behaviour-support / BSP implementation / steps | 4,000 | 5,635 | 4,000 | 0.051 | truncated at 4,000 output tokens; stopped (the outline is too big for one call; split in a later session, per the PO) |
| sole trader / incident policy / purpose | 1,500 | 2,376 | 488 | 0.010 (x2) | readability fail twice: grade 15.8, then 12.2 after the retry instruction; fell back |
| sole trader / incident policy / scope | 1,500 | 2,320 | 673 | 0.011 | passed first time; grade 8.6 |
| sole trader / incident policy / how we put this into practice | 4,000 | 2,328 | 3,052 | 0.035 | passed first time; grade 6.8 |
| sole trader / incident policy / responsibilities | 1,500 | 2,320 | 831 | 0.013 | passed first time; grade 6.3 |
| sole trader / incident policy / incident procedure | 1,500 | 2,305 | 1,500 | 0.020 | truncated at 1,500 output tokens; stopped |

## Batch 12 (2026-10-12): one run, 8 calls, about $0.13

| Case / document / section | Cap | In | Out | Dollars | Outcome |
| --- | --- | --- | --- | --- | --- |
| sole trader / incident policy / purpose (new brief) | 1,500 | 2,381 | 110 | 0.006 (x2) | first reply grade 16.5; passed on the readability retry at grade 10.3 |
| sole trader / incident policy / how we put this into practice (R-7 re-record) | 4,000 | 2,387 | 2,231 | 0.027 | passed first time; grade 5.5; no timeframe restated |
| sole trader / incident policy / responsibilities (R-7 re-record) | 1,500 | 2,379 | 760 | 0.012 | passed first time; grade 8.0 |
| sole trader / incident policy / incident procedure (4,000 cap) | 4,000 | 2,364 | 1,098 | 0.016 | passed first time; grade 5.5 |
| behaviour support / BSP implementation / steps: getting the plan | 4,000 | 5,752 | 1,001 | 0.022 | passed first time; grade 7.7 |
| behaviour support / BSP implementation / steps: putting the plan into practice | 4,000 | 5,765 | 1,049 | 0.022 | passed first time; grade 8.3 |
| behaviour support / BSP implementation / steps: monitoring, reporting and review | 4,000 | 5,772 | 862 | 0.020 | passed first time; grade 8.5 |

## Batch 13 (2026-10-12): re-recording after R-8, one run, 2 calls, about $0.04

| Case / document / section | Cap | In | Out | Dollars | Outcome |
| --- | --- | --- | --- | --- | --- |
| sole trader / incident policy / how we put this into practice (R-8 re-record) | 4,000 | 2,432 | 1,828 | 0.023 | passed first time; grade 5.4; "Every 3 months we review the Incident register", "Review this policy every 12 months", and the same values in its table |
| sole trader / incident policy / responsibilities (R-8 re-record) | 1,500 | 2,424 | 1,216 | 0.017 | passed first time; grade 6.4; rows "Reviews this policy and procedure. \| Every 12 months." and "Reviews the incident register ... \| Every 3 months." |

## Batch 13 (2026-10-12): two more documents, one run, 5 calls over 3 sections, about $0.07 (the case stopped at a truncation, so 2 of the 8 sections are recorded)

| Case / document / section | Cap | In | Out | Dollars | Outcome |
| --- | --- | --- | --- | --- | --- |
| sole trader / complaints policy / purpose | 1,500 | 2,497 | 461 | 0.010 (x2) | first reply grade 12.6; passed on the readability retry at grade 9.4 |
| sole trader / complaints policy / scope | 1,500 | 2,489 | 1,116 | 0.016 (x2) | first reply used "carers" (terminology lint); passed on the retry at grade 7.8 |
| sole trader / complaints policy / policy statement | 1,500 | 2,441 | 1,500 | 0.020 | **truncated at the 1,500 cap**; not retried (D-040); fallback callout |
| sole trader / complaints policy / how we put this into practice, responsibilities, complaints procedure | | | | 0 | not attempted: the recorder stops a case after a truncation |
| sole trader / self-assessment / our registration scope, how we meet these standards | | | | 0 | not attempted, same rule (same reference case) |

## Batch 14 (2026-10-12): finishing the two documents, two runs, 7 billed calls, about $0.15

| Case / document / section | Cap | In | Out | Dollars | Outcome |
| --- | --- | --- | --- | --- | --- |
| sole trader / complaints policy / policy statement (re-record, D-043 cap) | 2,500 | 2,441 | 1,892 | 0.024 | passed first time; grade 9.5 |
| sole trader / complaints policy / how we put this into practice | 4,000 | 2,548 | 2,459 | 0.030 | passed first time; grade 5.8 |
| sole trader / complaints policy / responsibilities | 1,500 | 2,540 | 1,462 | 0.020 | passed first time; grade 6.5 |
| sole trader / complaints policy / complaints procedure | 4,000 | 2,497 | 2,119 | 0.026 | passed first time; grade 5.8 |
| sole trader / self-assessment / our registration scope | 1,500 | 2,755 | 1,228 | 0.018 | passed first time; grade 8.3 |
| sole trader / self-assessment / how we meet these standards (first run) | 1,500 | 2,787 | 1,500 | 0.021 | **truncated** with only 1,618 characters of reply; stopped that document only (D-043 rule) |
| sole trader / self-assessment / how we meet these standards (second run, thinking off, D-530) | 1,500 | 2,786 | 721 | 0.013 | passed first time; grade 10.0; 2,393 characters |

## Batch 15 (2026-10-12): re-recording the three documents, run 1, all 14 sections (upper bound about $0.21, retry first calls counted at the last call's size)

| Section | Cap | In | Out | Dollars | Outcome |
| --- | --- | --- | --- | --- | --- |
| incident / purpose | 1,500 | 2,278 | 111 | 0.006 (x2) | fell back: grade 22, then 11.4 on the retry |
| incident / scope | 1,500 | 2,219 | 575 | 0.010 | first time, grade 9.3 |
| incident / policy statement | 2,500 | 2,303 | 656 | 0.011 (x2) | fell back: "policy and our register every 12 months" (right to reject), then a correct sentence rejected by a lint false positive (D-532) plus "complies with the Rules" |
| incident / how we put this into practice | 4,000 | 2,324 | 901 | 0.014 | first time, grade 6.3 |
| incident / responsibilities | 1,500 | 2,316 | 674 | 0.011 | first time, grade 7.2 |
| incident / incident procedure | 4,000 | 2,257 | 839 | 0.013 | first time, grade 6.0 |
| complaints / purpose | 1,500 | 2,305 | 143 | 0.006 (x2) | grade 15.2, then 9.7 on the retry |
| complaints / scope | 1,500 | 2,297 | 495 | 0.010 (x2) | "carers" (families and carers), then 8.0 on the retry |
| complaints / policy statement | 2,500 | 2,302 | 721 | 0.012 (x2) | fell back: "families and carers" twice (lint false positive, D-532) |
| complaints / how we put this into practice | 4,000 | 2,349 | 739 | 0.012 | first time, grade 6.3 |
| complaints / responsibilities | 1,500 | 2,420 | 653 | 0.011 (x2) | fell back: "Policy every 12 months; register every 3 months" twice, correct text rejected (D-532) |
| complaints / complaints procedure | 4,000 | 2,299 | 1,161 | 0.016 | first time, grade 6.9 |
| self-assessment / our registration scope | 1,500 | 2,929 | 400 | 0.010 | first time, grade 8.8 |
| self-assessment / how we meet these standards | 1,500 | 2,961 | 851 | 0.014 | first time, grade 9.3 |

## Batch 16 (2026-10-12): the full sole-trader set, per document (D-039 to D-046, thinking off, caching on; last-call tokens, retries counted at twice the last call)

| Document | Sections | First time | Retry | Fallback | Grades | Cache reads | Cached $ | Uncached $ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| incident management policy | 6 | 4 | 2 | 0 | 5.5 to 10.7 | 10,675 | 0.054 | 0.080 |
| complaints management policy | 6 | 3 | 3 | 0 | 5.9 to 9.3 | 12,275 | 0.065 | 0.098 |
| self-assessment | 2 | 2 | 0 | 0 | 10.1 to 10.3 | 4,321 | 0.018 | 0.025 |
| governance policy | 6 | 6 | 0 | 0 | 6.0 to 10.7 | 11,220 | 0.037 | 0.057 |
| risk management policy | 6 | 6 | 0 | 0 | 5.7 to 8.5 | 12,530 | 0.044 | 0.066 |
| continuity of supports plan | 6 | 3 | 3 | 0 | 6.1 to 10.1 | 11,190 | 0.068 | 0.098 |
| conflict of interest policy | 5 | 3 | 2 | 0 | 6.2 to 10.6 | 9,239 | 0.046 | 0.070 |
| privacy and information management policy | 5 | 4 | 0 | 1 | 7.6 to 10.6 | 9,695 | 0.030 | 0.051 |
| records management policy | 6 | 3 | 2 | 1 | 6.9 to 9.1 | 11,652 | 0.051 | 0.082 |
| worker screening and recruitment procedure | 5 | 3 | 2 | 0 | 7.1 to 8.7 | 10,399 | 0.051 | 0.077 |
| induction and training procedure | 5 | 4 | 1 | 0 | 8.0 to 10.5 | 10,207 | 0.044 | 0.066 |
| code of conduct acknowledgement | 2 | 2 | 0 | 0 | 6.7 to 7.3 | 3,666 | 0.017 | 0.023 |
| service agreement template | 3 | 2 | 1 | 0 | 4.7 to 7.3 | 5,291 | 0.034 | 0.047 |
| participant rights and choice policy | 6 | 6 | 0 | 0 | 6.8 to 10.0 | 11,200 | 0.039 | 0.059 |
| safeguarding policy | 6 | 4 | 2 | 0 | 5.8 to 8.8 | 11,724 | 0.048 | 0.076 |
| emergency and disaster management plan | 5 | 4 | 0 | 1 | 7.5 to 10.7 | 9,235 | 0.043 | 0.063 |
| AI use and governance policy | 6 | 4 | 1 | 1 | 6.9 to 9.4 | 11,300 | 0.051 | 0.079 |
| AI and digital data-handling procedure | 4 | 1 | 3 | 0 | 7.3 to 10.3 | 7,732 | 0.047 | 0.071 |
| behaviour-support case: BSP implementation procedure | 3 | 2 | 0 | 1 | 9.1 to 9.6 | 8,497 | 0.045 | 0.066 |
| **Total** | 93 | 66 | 22 | 5 | | 182,048 | **0.831** | 1.253 |

## Batch 16 (2026-10-12): the Haiku comparison (item 4, D-537; per section, Sonnet 5.5 and Haiku 5.5 side by side; last call; cached rates; Haiku prices assumed at $1 in / $5 out per million, UNVERIFIED)

| Section | Sonnet 5.5 | Haiku 5.5 | Sonnet grade | Haiku grade | Sonnet tokens | Haiku tokens | Sonnet $ | Haiku $ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| incident / policy statement | first time | first time (thinking on, first pass) | 10.7 | 10.3 | 2,240 in / 482 out | 2,241 in / 2,372 out | 0.010 | 0.015 |
| incident / purpose | retry | fallback (empty `usedFacts`, then grade 12.4; thinking on) | 9.0 | - | 2,302 / 87 | 2,303 / 1,038 | 0.003 | 0.011 |
| incident / scope | first time | retry (11.7, then 10.9) | 10.5 | 10.9 | 2,233 / 486 | 2,297 / 403 | 0.005 | 0.005 |
| incident / how we put this into practice | first time | first time | 5.5 | 9.9 | 2,342 / 805 | 2,342 / 678 | 0.009 | 0.004 |
| incident / responsibilities | first time | first time | 8.1 | 9.1 | 2,333 / 634 | 2,333 / 502 | 0.007 | 0.003 |
| incident / incident procedure | retry | first time | 6.0 | 9.2 | 2,353 / 862 | 2,274 / 930 | 0.019 | 0.005 |
| complaints / purpose | first time | retry (empty `usedFacts`; thinking on) | 9.3 | 9.3 | 2,263 / 96 | 2,318 / 106 | 0.003 | 0.002 |
| complaints / scope | retry | retry ("carers" twice, passed under D-532) | 9.1 | 11.0 | 2,311 / 439 | 2,332 / 408 | 0.010 | 0.005 |
| complaints / policy statement | retry | retry (11.3, then 7.9) | 9.2 | 7.9 | 2,318 / 544 | 2,329 / 490 | 0.012 | 0.006 |
| complaints / how we put this into practice | first time | retry ("business day") | 7.5 | 8.9 | 2,367 / 710 | 2,441 / 782 | 0.008 | 0.009 |
| complaints / responsibilities | first time | first time | 8.0 | 10.7 | 2,358 / 658 | 2,358 / 710 | 0.007 | 0.004 |
| complaints / complaints procedure | retry | fallback ("within 2 working days", then "support worker") | 5.9 | - | 2,396 / 1,082 | 2,395 / 846 | 0.023 | 0.009 |
| self-assessment / our registration scope | first time | fallback ("guarantee", then grade 11.8) | 10.3 | - | 2,946 / 483 | 3,018 / 355 | 0.009 | 0.004 |
| self-assessment / how we meet | first time | retry (12.3, then 9.6) | 10.1 | 9.6 | 2,979 / 784 | 3,043 / 783 | 0.009 | 0.009 |
| **Total / mean** | 9 first, 5 retry, 0 fallback | 5 first, 6 retry, 3 fallback | mean 8.5 | mean 9.7 | | | 0.136 (uncached 0.202) | 0.090 (uncached 0.135) |

## Batch 17 (2026-10-12): re-recording after D-047, D-049 and R-12 (item 3; one run, 18 billed calls over 17 sections, cached, thinking off, about $0.09; $0.13 uncached)

| Section | Outcome | Grade | Tokens (uncached in + cache write + cache read / out) | Cached $ |
| --- | --- | --- | --- | --- |
| governance / purpose | first time | 5.8 | 141 + 1,949 + 0 / 97 | 0.006 |
| governance / policy statement | retry (register every 12 months, rightly refused) | 8.2 | 256 + 0 + 1,949 / 606 | 0.007 x2 |
| continuity plan / purpose | first time | 10.2 | 135 + 468 + 1,475 / 118 | 0.003 |
| conflict of interest / purpose | first time | 8.5 | 141 + 466 + 1,475 / 103 | 0.003 |
| conflict of interest / policy statement | first time | 8.1 | 177 + 0 + 1,941 / 707 | 0.008 |
| privacy / purpose | first time | 10.9 | 158 + 464 + 1,475 / 138 | 0.003 |
| privacy / policy statement | first time | 9.6 | 194 + 0 + 1,939 / 740 | 0.008 |
| records / purpose | first time (11.7: short section, warns) | 11.7 | 140 + 467 + 1,475 / 116 | 0.003 |
| records / policy statement | first time | 8.1 | 176 + 0 + 1,942 / 868 | 0.009 |
| rights / purpose | first time | 8.3 | 141 + 470 + 1,475 / 99 | 0.003 |
| rights / policy statement | first time | 9.0 | 177 + 0 + 1,945 / 693 | 0.008 |
| safeguarding / purpose | first time (11.1: short section, warns) | 11.1 | 141 + 479 + 1,475 / 114 | 0.003 |
| safeguarding / policy statement | first time | 8.7 | 177 + 0 + 1,954 / 682 | 0.008 |
| emergency plan / purpose | first time | 10.2 | 147 + 465 + 1,475 / 106 | 0.003 |
| AI use policy / purpose | first time | 9.5 | 150 + 490 + 1,475 / 124 | 0.003 |
| AI use policy / policy statement | first time | 8.2 | 186 + 0 + 1,965 / 600 | 0.007 |
| AI data-handling procedure / purpose | first time (12.7: short section, warns) | 12.7 | 153 + 458 + 1,475 / 108 | 0.003 |
