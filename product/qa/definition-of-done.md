# Definition of done

A REQ is done only when the PO accepts it. Dev's delivery must show all of the following.

1. Every acceptance criterion in the REQ has a passing automated test or, where automation is unreasonable, a manual test record with steps and result.
2. Unit tests for deterministic logic were written before or with the implementation; coverage is not a target, but every branch in rules code (module applicability, audit pathway, entitlements, claims checker) is tested.
3. End-to-end tests cover the user path on Desktop Chrome and the 360x740 budget-Android project; screenshots attached for UI changes.
4. Lint, Prettier, typecheck, unit, build and e2e pass in CI on the branch.
5. Security requirements in the REQ are met and the relevant evidence from `product/security/threat-model.md` is attached.
6. Copy went through `assertNoProhibitedClaims`; brand placeholder used; Australian spelling.
7. Accessibility: keyboard-only pass of new screens, labels on all inputs, visible focus, contrast checked; Lighthouse accessibility 95+ on new pages. For form steps, a manual screen-reader pass (NVDA on Windows or VoiceOver on iOS) recorded in the evidence: each question is announced with its options and each option by its human label (REQ-013 FR-2).
8. Any assumption or unverified fact is in `DECISIONS.md` (and the `UNVERIFIED` register) with how to resolve it.
9. The REQ file's **Delivery evidence** section is filled in; the PR description links the REQ.
10. No new runtime dependency without a one-line justification in the REQ; no dependency with known high-severity advisories.
11. Every form a customer submits has one end-to-end test that submits it through the real handler, on all three Playwright projects, as the customer would: a fresh user where the form creates something, the real button, the real result on the next screen. A seeded shortcut (an admin insert, an RPC, a cookie written by the test) never stands in for the form. (Batch 45 item 28: the account form's save failed on the client for every customer from batch 37 up, and no test submitted it.)
