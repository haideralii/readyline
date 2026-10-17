# Lawyer read of the five legal pages, 16 October 2026, worktree c8d7276

This is the lawyer role's read, not legal advice; it is the gate until a practising lawyer reviews the product, which the PO schedules after the first paying clients.

Pages read: `product/legal/about.md`, `ai.md`, `privacy.md`, `refunds.md`, `terms.md`, each `status: draft`, each dated 2026-10-15, with the runtime tokens `{{business-line}}` and `{{subscription-off}}` resolved by `src/lib/legal/tokens.ts`. Law read: the Australian Consumer Law (Sch 2, Competition and Consumer Act 2010, compilation No. 167, C2026C00405, 16 September 2026) and the Privacy Act 1988 with its APPs (compilation No. 104, C2026C00227, 4 June 2026), both from legislation.gov.au on 16 October 2026 and VERIFIED for every section cited unless marked; the full source list is `.claude/skills/lawyer/sources.md`. The ACL test applied to each sentence: who reads it, what impression it leaves, whether it is true and will stay true (s 4 for future matters), and whether the hedge sits where the claim sits. The APP test applied to the privacy page: collection, notice, use, disclosure, retention, access. Findings are numbered through the file; severity is wrong / missing / unclear / for a practising lawyer. Where a page is sound, it says so. The consolidated questions with the fuller reads are in `product/legal/questions-for-the-lawyer.md`.

## terms.md

1. (unclear) `terms.md:18` "speak to a lawyer or a qualified consultant". The sentence sends a reader with a question "about your specific situation" to a consultant as an equal to a lawyer, which widens what Readyline implies a consultant can answer and sits oddly with CLAUDE.md 4.2. ACL s 18. Fix: "speak to a lawyer".

2. (unclear) `terms.md:50` "our liability to you is limited to the amount you paid Readyline in the 12 months before the claim". For a failure of a consumer guarantee, s 64(1) voids a term "to the extent that the term purports to exclude, restrict or modify ... any liability", and s 64A(2) allows a limitation for business-type services only to "the supplying of the services again" or "the payment of the cost of having the services supplied again"; a money cap is neither. "Where the law allows" keeps the term alive for other claims. In a standard form small business contract (s 23(4)(b)(i); s 27(1) presumption) the cap is s 25(k)'s example. Fix: one sentence that for a consumer guarantee the remedies are the ACL's, and the cap applies to other claims; the practising lawyer decides whether a s 64A(2) re-supply term is wanted.

3. (unclear) `terms.md:46` "We may change features, prices for future purchases, and these terms. We give at least 30 days' notice of changes to prices or terms that affect a subscription." A one-party variation right is s 25(d)'s example and a price variation "without the right of another party to terminate" is s 25(f)'s; the cancel-at-any-time right at `:30` answers (f), notice answers part of (d). Fix: add that a subscriber who does not accept a change may cancel before it takes effect and is charged nothing further.

4. (missing) `terms.md:30` "If a payment fails, access pauses until it is paid; nothing extra is charged." REQ-024 D-2415 keeps the account export, with every worker table, available whatever the subscription state because the Worker Screening Rules s 21 record is the provider's; the terms say less than the product does, and a reader whose payment failed is told the opposite of what they would find. Fix: add beside it that the account export, including worker records, stays available while access is paused.

5. (unclear) `terms.md:30` and `refunds.md:24` never say whether a failed period is owed. "nothing extra is charged" and "nothing is added to what you owe" presuppose an amount owed. Fix: say in one sentence whether access resumes from the next successful payment with nothing owed for the gap.

6. (unclear) `terms.md:40` "We may suspend an account that breaks these rules, and we will tell you why." s 25(b) and (h) examples (one party may terminate; one party decides breach); the narrow rule list and "we will tell you why" mitigate. Fix: add that a suspended customer keeps the export and may ask by email for the decision to be looked at again.

7. (sound) `terms.md:14` the independence and trade mark sentence; `:18` "does not guarantee that you will pass an audit or be registered"; `:24` "at least 18 and buying for a business" (which does not take the buyer out of s 3(3), since reg 77A's $100,000 threshold governs, and keeps them inside s 23(4)'s small business contract); `:28` the no-interest, no-late-fee sentence (CLAUDE.md 5); `:32` the refunds page "forms part of these terms"; `:36` the ownership and no-resale sentence; `:42` the shared-link sentence, which rightly makes a shared register the provider's own disclosure; `:46` the 12-month download promise (a future matter under s 4 with grounds in the export and retention rules); `:58` NSW law. Suggestion that would make `:42` sounder: add "and for any worker named in a note" after "check them for names", since the link's pack carries worker codes and notes.

## refunds.md

8. (sound) `refunds.md:16-18` the two promises and `:36` "Nothing on this page limits your rights under the Australian Consumer Law". The page sits above the statutory floor (s 267(2) remedy within a reasonable time; s 267(3) termination for a major failure; s 269(3) refund of what is not consumed) and the closing line stops it reading as the whole of the buyer's rights (s 29(1)(m)). Suggestion: keep a dated log of refund decisions so "we decide in your favour" (`:18`) has the s 4(2) evidence behind it.

9. (unclear) `refunds.md:12` "If you are not, tell us and we will put it right or refund you." Read with `:16-18`, a buyer who downloaded documents that match their answers has no refund under the page, yet the first sentence promises one; the two readings collide. Fix: make the first sentence point to the two cases below ("as set out below") rather than stand as an unconditional promise.

10. (sound) `refunds.md:28` "You do not need to give a reason"; `:32` the two-business-day reply and the bank timing stated as "usually".

## privacy.md

11. (for a practising lawyer, high) `privacy.md:62` "Some small businesses are not covered by the Privacy Act 1988. We follow the Australian Privacy Principles anyway". True, and incomplete. Under s 6C an individual is an organisation unless a "small business operator"; s 6D(1) sets $3,000,000; s 6D(4)(c) removes that status from one who "discloses personal information about another individual to anyone else for a benefit, service or advantage", which is the limb Readyline's disclosures to Anthropic, Supabase, Vercel and Stripe raise, lifted by s 6D(7) where the disclosure is "with the consent of the other individual". s 6EA lets a small business operator opt in "while a choice ... is registered". Fix: say in one sentence whether Readyline has made the s 6EA choice, and if it has not, that the APP promise is Readyline's own undertaking to its customers (which the ACL then enforces under ss 18 and 29(1)(g)).

12. (missing if an APP entity; unclear otherwise) `privacy.md:41-43` overseas recipients. APP 1.4(g) asks for "the countries in which such recipients are likely to be located if it is practicable"; APP 8.1 requires reasonable steps before a cross-border disclosure unless 8.2 applies. The page names the United States for Anthropic and no country for Stripe ("outside Australia") or Vercel ("elsewhere briefly"). Fix: name the countries where Readyline can, or say it cannot and why.

13. (missing) `privacy.md:50-54` "Your choices" gives the owner export, delete and correct, and gives a worker nothing. APP 12.1 ("on request by the individual, give the individual access"), 12.4 ("within a reasonable period"), 12.9 (written reasons on refusal) and 13.1 (correction) apply to everyone whose information Readyline "holds" (s 6: "possession or control of a record"), which once REQ-024 lands includes workers and the owner's notes about them. Fix: add a worker paragraph: what a worker sees on their home, that anything else is given on request by email within a reasonable period, and that a refusal comes with written reasons. The candidate line REQ-024 SR-1 records is consistent with APP 12.

14. (unclear) `privacy.md:58` "we tell you and the regulator as the law requires". The notifiable data breaches Part applies where "an APP entity holds personal information" (s 26WE(1)(a)); if Readyline is not an APP entity the law requires nothing of it, and the sentence promises less than it seems. Fix: "we tell you, and the Office of the Australian Information Commissioner where the law requires it".

15. (unclear) `privacy.md:42` "It does not use our requests to train its models." A representation about Anthropic's present conduct, true while its commercial terms say so; REQ-022 FR-11 reads the terms page into the bundle with a date. Fix: add "under its commercial terms, as read on <date>" here and at `ai.md:22`.

16. (unclear) `privacy.md:66` "We reply within five business days" is the complaint handling; APP 1.4(e) asks "how the entity will deal with such a complaint". Fix: one sentence on what happens after the reply (who decides, and the OAIC path already named).

17. (sound) `privacy.md:16-23` the collection list (APP 1.4(a), (b)); `:27` the no-participant-data rule and "we may remove it and tell you" (APP 4.3 if an APP entity; Code of Conduct s 6(1)(b) for the provider); `:31-36` purposes and the no-sale sentence (APP 1.4(c), APP 6.1); `:48` retention (APP 11.2); `:21` the worker-codes sentence, which rightly says the register is "the companion to the list the Worker Screening Rules ask you to keep, not the list itself" (Rules s 18(3)(a) needs "full name, date of birth and address", which the product does not hold). Suggestion for `:21` when REQ-024 lands: SR-1's rewording ("never keep") and the one-time-fill sentence, since "never ask for" beside a fill screen would be the s 18 pair SR-1 names.

## ai.md

18. (sound) `ai.md:14-18` the fixed-text and tailored-text split, which is a factual description the product can show; `:26` the checks, verifiable from `findProhibitedClaims`; `:34` the drafts-for-review and no-guarantee sentences; `:38` the wrong-output line. Suggestion for `:14`: "the reportable incident rules and timeframes" are fixed text, which is right, and the page could say the fixed text is checked against the Rules on a dated read so the reader knows how it stays current (no promise, a process).

19. (unclear) `ai.md:22` as finding 15.

20. (unclear) `ai.md:30` "so an auditor finds it with your privacy commitments". A statement about what an auditor will do, a future matter under s 4; the grounds are the pack's structure, not the auditor's conduct. Fix: "so it sits with your privacy commitments, where an auditor would look for it" keeps the reason without the prediction.

## about.md

21. (sound) `about.md:18` "It is not a law firm and not a consultancy"; `:22` the independence paragraph, which matches CLAUDE.md 4.4 and says any auditor list "will be free and we will say so"; `:26` the fixed-price and no-interest sentence; `:30` the Sydney data line with the overseas pointer to the privacy page; `:34` the two-business-day reply stated as "usually".

22. (unclear) `about.md:14` "Readyline works out your audit type and the standards that apply". A present-tense statement that the product determines the audit type; the Rules' s 20(3) table and the Commission decide, and the result page's own convention hedges it. Fix: "tells you which audit type and standards the Rules point to for your answers", which keeps the claim to what the product does.

## What a practising lawyer must still confirm, ranked by exposure

1. Whether Readyline is an APP entity (Privacy Act ss 6C, 6D(4)(c), 6D(7), 6EA), since findings 11 to 14 and the overseas-disclosure duty turn on it; and whether an opt-in is wise.
2. The consumer guarantees of fitness for purpose and result (ACL s 61(1), (2)) against a provider whose audit went badly, and what the general-information statement does to reliance (s 61(3)); findings 1, 2 and 8.
3. The unfair-terms exposure of the liability cap, the variation term and the suspension term in a standard form small business contract (ss 23 to 25, 64A); findings 2, 3, 6.
4. The provider's own Privacy Act position (s 6FB(3)(b) with s 6D(4)(b)) and what the generated privacy policy and worker screening procedure must say about workers who are not employees (s 7B(3)); whether a screening decision code is sensitive information (s 6 "criminal record").
5. The state screening Acts' secrecy provisions for the auditor link, with NSW and the NT unread, and the two Victorian questions on the Worker Screening Rules s 25(5)(d)(iii) against the Worker Screening Act 2020 (Vic) ss 118 and 119.
6. The Legal Profession Uniform Law (NSW) line for tailored drafting, and the NDIA's trade mark particulars for the nominative use of "NDIS", both low.
