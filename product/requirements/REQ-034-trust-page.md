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

## Delivery evidence

(Dev appends: branch, commits, test counts, screenshots of `/trust` and `/sample` on desktop and Android.)
