# REQ-034: The trust page, the sample in both formats, and the pricing page's plain lines

Status: ready for Session A (PO, 18 Oct 2026 23:55; lawyer's and NDIS expert's reads applied as D-2944 to D-2951, D-2222)
Phase: 6   Priority: should   Owner: Dev (one session, Dev-1)

## Why (user and business outcome)

- A provider choosing a tool that will hold their business records asks three questions before paying: where is my data, who else sees it, and what happens when I leave. Today the answers exist, spread through `privacy.md`, `ai.md` and the home page's cards; nobody reads three pages to find them. The competitor research of 18 Oct 2026 found the nearest rival shipping those answers as unfilled placeholders; our answers are written and tested, and should be one screen.
- An auditor asks the same questions of the provider (Practice Standards, privacy and information management; the provider's own statement on digital tools is an appendix to their privacy policy, D-2314). A provider who can hand over one dated page about the tool they use answers that indicator faster (NDIS expert, D-2944).
- The pricing page says "one fixed price" but not what that rules out; the market sells credits that expire. Three plain lines close the gap.
- The sample on `/sample` is one Word file; a buyer on a phone cannot open it. A PDF beside it, and the pack's document list for their audit type, is what they look at before paying.

## Scope

In: `/trust` (one page), its links from the footer, the pricing page and the AI page; the sample as PDF and DOCX; the pack list on `/sample`; three pricing lines; the "last reviewed" dates; copy lint; the a11y spec.
Out: any new promise not already in `privacy.md` or `terms.md`; any security attestation (no "bank-level", no certification we do not hold); changes to the privacy policy's substance.

## Functional requirements

- **FR-1 The trust page.** `/trust`, public, titled "Where your data lives and who can see it". A table of eight rows, each a question in the provider's words and a one-sentence answer with a link to the privacy policy section that is its source: Where is it stored (Supabase, Sydney); Who processes it and where (Vercel, Anthropic, Stripe, GitHub backups, Sentry, the email provider, each with its country as `privacy.md` names it); Is participant information held (never; the forms warn and refuse); Is my data used to train AI (no, under the model provider's commercial terms, with the read date); How long is it kept (while the account is open; removed within 30 days of deletion; purchase records as the law requires); Can I take it out (the export, in one click, every table listed in D-2898); Who can sign in (the owner, the workers the owner invites, an auditor through a time-limited link); What happens if there is a breach (the notification sentence from `privacy.md`). Every answer is pinned in `legal-copy.test.ts` to the privacy policy's sentence it derives from, so the two cannot drift (lawyer, D-2945).
- **FR-2 The date and the owner.** The page carries "Last reviewed <date>" from the privacy policy's `updated` front matter, and the one-line business identity the footer uses (name and ABN once set, D-2810's rule). No other prose.
- **FR-3 Where it is linked.** The footer's legal links gain "Where your data lives"; the pricing page's card carries "Where your data lives and who can see it" under the price; the AI page links it in its first paragraph. The home page's "No participant data" card links it (D-2946: the card's words stay).
- **FR-4 The sample in both formats.** `/sample` serves the complaints policy as PDF beside the Word file, rendered by the same LibreOffice step the pack uses (D-504), both from the recorded run, both carrying the footer "Sample prepared with Readyline for a fictional sole trader" on every page (D-2947). The page's line above the files says the sample is from a recorded run for a fictional provider and that a buyer's own documents come from their answers.
- **FR-5 The pack list on the sample page.** Under the sample, "What a pack holds" lists the document titles for the sole-trader verification case and, in a second disclosure, the certification case (the catalogue's titles, counted: "18 documents"), each list from `document-sets.json` so it cannot go stale; one glossary line for "verification" and "certification" (D-2852's one-sentence rule).
- **FR-6 The pricing page's three lines.** Under the price: "One price for every document in your pack." "No credits, no expiry: your documents are yours to keep and edit." "No subscription is needed to use what you bought; the registers are a separate subscription you can cancel at any time." All three pinned; the claims lint runs over them (D-2948: these describe our terms, not a comparison; the words "credit", "expiry" and "subscription" name what we do not do and are not a competitor reference).
- **FR-7 Words.** No "secure", "safe", "bank-level", "guaranteed", "compliant" or "certified" on the page; the headings are questions; sentences under 20 words; Year 8 reading level per the house style (D-2949).

## Security and privacy

- SR-1 The page is static and public; no request leaves the server to build it.
- SR-2 The sample PDF is built once at build time from the fixture run, not per request.

## Acceptance criteria

- AC-1 `/trust` renders the eight rows with their links; each link opens the privacy policy at the section anchor (e2e, desktop and Android, axe at 360 and 1280).
- AC-2 `legal-copy.test.ts` pins every answer to its privacy-policy sentence; a change to one without the other fails.
- AC-3 Footer, pricing card, AI page and the home card link to `/trust` (e2e).
- AC-4 `/sample` serves `complaints-policy.pdf` and `.docx`, both with the FR-4 footer on every page (PDF text extracted in the test); the page's line is pinned.
- AC-5 The pack lists count and name the catalogue's documents for both cases (unit).
- AC-6 The three pricing lines are present, pinned and pass the claims lint (unit, e2e).
- AC-7 FR-7's banned words are absent from the page (copy lint extended with the page).
- AC-8 `npm run check` green; a11y spec covers `/trust`.

## Lawyer's read (D-2945, D-2947, D-2948, D-2950)

A page that restates the privacy policy is safe only while it says exactly what the policy says; the pin (D-2945) is the control. The sample's footer and the page's line make the sample's status plain, so no reader takes it for advice or for a document of theirs (D-2947). The pricing lines describe our own terms; they name no one and compare to nothing (D-2948). D-2950: the breach row quotes the policy's sentence as it stands (notification where the law requires it) and adds nothing about timeframes we have not committed to.

## NDIS expert's read (D-2944, D-2946, D-2949, D-2951)

The provider's privacy indicator asks how participant and worker information is protected in the systems the provider uses; a dated page from the tool, written in plain words, is the evidence a provider attaches to their own privacy policy's digital-tools appendix (D-2944). The home card's "No participant data" stays as is; the trust page carries the longer answer (D-2946). The reading level matters because the page is read by sole traders, not procurement teams (D-2949). D-2951: the pack lists on `/sample` show the verification and certification cases, because the choice between them is the first thing a buyer wants to see, and the result page is where the real answer comes from.

## Dev response

Dev-1, 19 Oct 2026, on `req-034-session-a` from `next` a60f7df. The REQ cites D-2944 to D-2951; they are not yet in `DECISIONS.md` on main, so I read them from the REQ's text.

**What is on the branch today that this builds on.** The legal pages render `product/legal/*.md` through `LegalArticle`, which gives every `h2` an id from `slugify(heading)`, so the privacy policy already has the anchors FR-1 needs (`#who-helps-us-run-the-service`, `#what-we-never-collect`, `#how-long-we-keep-it`, `#your-choices`, `#security`). `legal-copy.test.ts` pins sentences verbatim per page. The sample Word file is rendered from `data/samples/complaints-policy.json` by `renderDocx` in a route that caches the bytes once per server process. `deriveDocumentSet(moduleIds, groupCodes, existing)` gives a result's document list from `document-sets.json`; `loadReferenceCases()` gives the sole-trader verification and the personal-care certification cases with their results. `GlossaryTerms` carries D-2852's one-sentence glossary; `verification-audit` and `certification-audit` are in it. `PRICING_COPY` holds every pricing string and `copy.test.ts` runs the claims lint over all of them.

**Approach, Session A (four commits).**

1. **The trust page (FR-1, FR-2, FR-7, SR-1).** `src/lib/trust/answers.ts`: eight rows, each `{ id, question, answer, anchor, sources }`, where `sources` are the privacy policy sentences the answer derives from, verbatim. `/trust` (`src/app/trust/page.tsx`, static, public): the title "Where your data lives and who can see it", a two-column table from `sm` (a stacked list at 360), each row the question, the one-sentence answer and a link "In the privacy policy" to `/privacy#<anchor>`; under it "Last reviewed <date>" from `privacy.md`'s `updated` and the footer's business line (name and ABN once set, else the brand alone, D-2810's rule). The pins (AC-2) live in `legal-copy.test.ts`: every source sentence is in `privacy.md` verbatim, every answer is pinned verbatim, and every number and place name in an answer ("Sydney", "United States", "30 days", "90 days") appears in its sources, so a change to the policy or the answer fails alone. `trust/answers.test.ts` holds FR-7: none of secure, safe, bank-level, guaranteed, compliant, certified; every heading ends in a question mark; every sentence under 20 words; the page's reading grade at or under 8 (a failure, not a warning, since the words are ours; question 4). `LEGAL_NAV` gains `trust` ("Where your data lives"); `req-015-a11y.spec.ts` gains `/trust`; the copy lint's page list gains the page.
2. **The links and the pricing lines (FR-3, FR-6).** `PRICING_COPY` gains the link words and the three lines, rendered under the pack card's price; `copy.test.ts` pins the three and runs the claims lint over them (D-2948). The home "No participant data" card keeps its words and gains the link line "Where your data lives" (question 7). `ai.md`'s first paragraph gains one sentence linking the page; its `updated` is already 18 October (REQ-033) and moves to the 19th with this change, the pin following.
3. **The sample in both formats and the pack lists (FR-4, FR-5, SR-2).** `data/samples/complaints-policy.json`'s `footer` becomes "Sample prepared with Readyline for a fictional sole trader", so the Word file's footer reads it on every page through `footerLead` as today. The PDF comes from a pdf-lib renderer of the same model (question 1), `src/lib/generator/pdf-document.ts`: title, document control table as rows, numbered headings, paragraphs, bullets, steps, callouts and tables as text rows, the footer and page number on every page; served by `/sample/complaints-policy.pdf`, rendered once per server process and cached, rate-limited like the Word route (question 5). `/sample` shows the two files side by side with the FR-4 line above them, pinned in `home-copy.test.ts`. Under the sample, "What a pack holds": two disclosures, the sole-trader verification case and the personal-care certification case, each the result's document titles from `deriveDocumentSet` with the count in the summary ("18 documents"), and the glossary line for the two audit words; `sample-pack-lists.test.ts` holds the counts and titles against the catalogue (AC-5).
4. **The spec and the evidence.** `e2e/req-034.spec.ts` (public; desktop and Android): AC-1 the eight rows, each link opening the privacy policy with the hash and the heading in view, axe serious/critical at 360 and 1280 and the sideways-scroll check; AC-3 the four links; AC-4 the PDF fetched and read page by page (`pdfjs-dist`, question 6) for the footer, the Word file's `footer1.xml` for the same words, the page's line; AC-6 the three lines on the pricing page. D-2301 in `DECISIONS.md`.

**Questions (none blocks the start; I build on the recommendations).**

1. *FR-4's "same LibreOffice step the pack uses".* LibreOffice runs only in D-504's CI job, which converts every rendered Word file to prove it converts and ships nothing; the pack itself holds Word files, and neither Vercel nor my laptop has LibreOffice. (a) Render the sample PDF with pdf-lib from the same model (the repo's readiness summary already renders this way), the footer guaranteed by code on every page; it will not look identical to Word's rendering. (b) Convert in CI with LibreOffice, upload the artefact, commit `data/samples/complaints-policy.pdf`, and have the LibreOffice job fail when a fresh conversion's text differs from the committed file's. (c) (a) now, (b) later. **(a)**: one code path, no committed binary to go stale, SR-2 met.
2. *Row 7, "Who can sign in".* `privacy.md` has no single sentence for it; the answer derives from three: "Each account can only see its own data, enforced in the database", the invited worker's hashed email address, and the auditor's time-limited link. (a) Pin the answer to those three, anchored at Security. (b) Ask you to add one sentence to `privacy.md` (its substance is out of scope for me). **(a)**.
3. *Row 3, "the forms warn and refuse".* The policy says warn and "we may remove it and tell you"; refusing a name in a code field or an NDIS-number shape is what the register schemas do (REQ-018's tests). (a) "Never. Readyline is for your business information only. The forms warn you, and refuse a name or an NDIS number where they can tell." pinned to "What we never collect", with the refusal half tied to the schema tests. (b) Drop "refuse". **(a)**: it is true and it is the answer a provider wants.
4. *FR-7's reading level.* The legal pages warn above their grade; the trust page's words are ours and short. (a) Fail at grade 9 or above. (b) Warn. **(a)**.
5. *SR-2 "built once at build time".* (a) Once per server process at the first request, cached, as the Word route does; no request leaves the server and no model is called. (b) A committed file (question 1 (b)). **(a)**.
6. *Reading the PDF in the test.* `pdfjs-dist` arrives on `next` with #122 (REQ-033). (a) Add the same version here so the branch stands alone; identical lock lines merge clean. (b) Wait for #122. **(a)**.
7. *The home card (D-2946).* The cards are title and text. (a) The "No participant data" card gains one link line under its words, "Where your data lives", nothing else changes. **(a)**.

**Hours.** 7 to 9: the page and its pins 2 to 3, the links and lines 1, the PDF renderer and the lists 2 to 3, the spec and evidence 1 to 2.

## Delivery evidence

(Dev appends: branch, commits, test counts, screenshots of `/trust` and `/sample` on desktop and Android.)
