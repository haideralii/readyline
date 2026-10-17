# Readyline live QA — report A: public questionnaire flow

Site: https://readyline-zeta.vercel.app (release sha b340ee3) · Date: 2026-10-18 · Tester: QA agent (Playwright 1.64, Chromium headless, desktop UA Chrome 130 on Windows for 1280×800; Android Chrome 130 UA with touch for 360×740).

Scenario: sole trader, trading name "Sunrise Supports", NSW, registration group 0107 (Assistance with daily personal activities), restrictive practices "No", 3 workers / 1 key personnel / risk-assessed roles yes / all screened yes, "No" to all five "already have" questions. Signed out throughout. No account created, no email entered, nothing submitted except the questionnaire steps. Every step filled through the UI (fill / check / click).

Scripts: `run.mjs` (the full pass, `node run.mjs 360|1280`), `probe-post.mjs` (server-action abort timing), `probe-cls.mjs` (layout-shift observer + pixel diff). Raw results: `results-360.json`, `results-1280.json`, logs `run-360.log`, `run-1280.log`. All paths below are relative to ``.

## Summary

| Total checks | PASS | FAIL | NOTE |
|---:|---:|---:|---:|
| 325 | 276 | 0 | 49 |

**FAILs: none.** Every scoped behaviour matched the e2e specs' expectations on both viewports. Two things I first flagged as FAIL turned out to be my own test set-up (the first-checkbox height measured after I had opened the hint and triggered the validation summary; a tick lost because I pressed Back without saving) and were re-run cleanly; they are kept as NOTEs where they matter to a reader.

Screenshots (both widths): shots/home-{360,1280}.png, shots/start-intro-*.png, shots/start-intro-continue-*.png, shots/step1-business-*.png, shots/step2-supports-*.png, shots/step3-practices-*.png, shots/step4-workforce-*.png, shots/step5-existing-*.png, shots/step6-result-first-*.png (first visit), shots/step6-result-open-*.png (all sections open), shots/result-start-again-confirm-*.png, shots/pricing-*.png, shots/sign-in-*.png, shots/step1-after-change-answers-1280.png, shots/cls-early-{1,2}.png / shots/cls-late-{1,2}.png.

## Observations and anything that reads wrong (NOTE)

| Status | Viewport | Page | What | What I saw |
|---|---|---|---|---|
| NOTE | both | /start/result | Layout shift sanity (PerformanceObserver layout-shift, 2 s, buffered, two full loads at 1280 + one at 360) | 0 layout-shift entries on every full load (observer confirmed installed, `__clsOk=true`). What a viewer does see: for ~350 ms the page shows the heading, stepper and the line "Working out which standards apply…", then the card and sections replace that line in place (23.8 % of pixels change between 250 ms and 2 250 ms, nothing above it moves). Not a jump; a loading state. Shot: shots/cls-early-1.png vs shots/cls-late-1.png. |
| NOTE | both | /start/result | Network: `POST /start/result` (server action, next-action 401ade53…) reported as `net::ERR_ABORTED` ~20 ms after a 200 response, on the SPA arrival and on a reload | The response is 200 and the page renders; the client cancels the remainder of the RSC stream after reading it (Next.js behaviour). No console error, no visible effect. Reproduce: probe-post.mjs. |
| NOTE | both | every page | Network: many `GET <route>?_rsc=… net::ERR_ABORTED` | Next.js link prefetches cancelled when the next navigation starts. Benign, filtered out of the tables below. The six `GET /terms /privacy /refunds /ai /about /guides net::ERR_ABORTED` on the home page are my own fetch() link checks (all answered 200 first; the body was abandoned on navigation). |
| NOTE | both | every page | Console errors / warnings / pageerror | None on any page at either viewport (home, /start, six steps, /pricing, /sign-in). |
| NOTE | both | /start/supports → Back | Copy/UX for a nervous owner: a tick made on step 2 and then **Back** pressed (without Save and continue) is silently lost; the same for an answer on step 3 followed by a browser reload | Back is a plain link; the draft is written only on "Save and continue" and the status line says so ("Your draft will be saved locally on this device after each step."). No warning is shown. Expected per source (fields.tsx StepButtons) but easy to trip over on a phone. |
| NOTE | both | /start/business (after Change my answers) | After **Change my answers** the stepper shows steps 2–6 as "not yet" with no links, so the only ways back to the result are five more "Save and continue" presses, the browser Back button, or /start → "Continue where you left off" (which does point at /start/result) | Stepper list read "1. Business: current 2. Supports: not yet 3. Practices: not yet 4. Workforce: not yet 5. Already have: not yet 6. Result: not yet" (shots/step1-after-change-answers-1280.png). Matches stepper.tsx (`done` = i < current index), so by design, but a person who wanted to change one answer on step 4 has to walk forward from step 1. |
| NOTE | both | /start (after Start again) | **Start again** clears the answers draft but leaves `readyline.result.open` in localStorage | After confirming, localStorage still held `readyline.result.open=["documents","registers","doc-group-your-workers"]`. The next result on this device will open with the remembered sections, not the first-visit rule (closed at 360 / open at 1280). Minor; arguably "this device remembers". |
| NOTE | both | /pricing | Copy: the pack card's h2 is "Price" while the subscription card's h2 is "Registers subscription" | Pack card reads: eyebrow "Where you start", h2 "Price", then "AUD 399 one-off, for the document pack". The two cards share one skeleton but the pack card never names the product in its heading; the strip and home call it "Document pack". |
| NOTE | both | /start/result | Copy: "What happens next … Go to your documents if you already have one." | "one" has no clear antecedent (an account? a pack?). A first-time reader does not know what "one" is, and the link goes to a sign-in. |
| NOTE | both | /start/result | Copy: "Checklist: 40 items (27 above plus 13 about your workers, insurance and the audit)" | Dense for a card line; the 13 are not visible anywhere on this page (they appear only after sign-in). Reads like arithmetic homework. |
| NOTE | both | /start/result | Registers list: two rows carry no tag beside rows tagged "You need one" | "Worker screening clearance register" and "Policy review register" have no tag because step 5 did not ask about them (by design, D-2718). Beside three "! You need one" tags, an untagged row can read as "you don't need this". |
| NOTE | both | /start/supports at 360 | The supports step is long on a phone: 4 856 px tall with the hint closed and every group closed; the first tickable class sits at y = 915 px (limit 950) | About 1.25 screens of scrolling before the first checkbox. Inside the limit, with 35 px to spare. |
| NOTE | both | / and /start/result | Trust: the contact link is a personal Gmail address (`mailto:haiderali14se89@gmail.com`) in the footer and in "Questions about your result? Email …" | A nervous owner comparing with "Hosted in Australia" and "Sourced to the Commission" may find a Gmail contact less reassuring than a domain address. Not a defect. |
| NOTE | both | /sign-in | Read only: the sign-in page is a single email field and "Email me a sign-in link" (magic link). Not touched. | Result's primary button → /sign-in?next=%2Fpath%2Fbefore-you-buy; pricing's "Sign in to buy" → /sign-in?next=%2Fpricing; documents section's "Open these in your checklist" → /sign-in?next=%2Fchecklist. All 200. |

## Detail: every scripted check

Order is the order of execution (home → /start → steps 1–6 → change answers → start again → pricing → sign-in). "What I saw" quotes the on-screen text or the measured geometry.

### Viewport 360x740

| # | Status | Page | Check | What I saw | Shot |
|---:|---|---|---|---|---|
| 1 | PASS | / | GET / status | 200, title "Readyline: registration-readiness for small NDIS providers" |  |
| 2 | PASS | / | h1 asks the audit question and names the price | h1: "Find out which NDIS audit you'll face — free. Then get every document it needs, drafted from your answers, for AUD 399." |  |
| 3 | PASS | / | section headings present | h2: "What a result looks like", "See exactly what you get", "What you can count on", "Why one price, and who is behind it" |  |
| 4 | PASS | / | primary CTA label and href | "See which audit I need" -> /start |  |
| 5 | PASS | / | primary CTA is inside the first screen | CTA bottom at 599px of 740px |  |
| 6 | PASS | / | primary CTA uses the primary style | class="btn-primary" |  |
| 7 | PASS | / | free line | "Free, about ten minutes, no account needed." |  |
| 8 | PASS | / | price strip cell 1 (registers) | "Registers subscription · AUD 39 a month" -> /pricing#keeps |  |
| 9 | PASS | / | price strip cell 2 (pack) | "Document pack · AUD 399 one-off" -> /pricing#start |  |
| 10 | PASS | / | price strip cells one size and weight | [{"size":"16px","weight":"400","nums":"tabular-nums"},{"size":"16px","weight":"400","nums":"tabular-nums"}] |  |
| 11 | PASS | / | price strip cells stack at 360 | registers y=707 h=66; pack y=781 |  |
| 12 | PASS | / | price line under strip | "Where you start: AUD 399 one-off for the document pack. No subscription needed, no instalments, no interest. Full refund within 14 days if you have not downloaded the documents; after a download, a refund if they do not match your answers. Refunds." |  |
| 13 | PASS | / | subscription line under strip | "What keeps you audit-ready: AUD 39 a month keeps you audit-ready: the registers, the reminders and the mid-term audit countdown, so your evidence sits in one place when renewal comes. Cancel at any time." |  |
| 14 | PASS | / | example result card present | "What a result looks likeA sole trader in New South Wales delivering household tasks (class 0120):Your audit: verification. You will need 15 documents and 5 registers. An approved auditor checks your documents without com..." |  |
| 15 | PASS | / | example card ready line | "0 of 20 documents and registers in place, 20 still to do." |  |
| 16 | PASS | / | example card follows the hero text at 360 | h1 bottom 351; example y=1226 |  |
| 17 | PASS | / | four trust cards | 4 cards: Sourced to the Commission. Every module, standard and audit  \| Hosted in Australia. Your business details stay in an Austra \| No participant data. Readyline never asks for participants'  \| Independent. Not affiliated with the NDIA or the Commission, |  |
| 18 | PASS | / | footer links | Terms -> /terms, Privacy -> /privacy, Refunds -> /refunds, How we use AI -> /ai, About -> /about, Guides -> /guides, Contact -> mailto:haiderali14se89@gmail.com |  |
| 19 | PASS | / | no horizontal overflow | scrollWidth=360 clientWidth=360 offenders=none |  |
| 20 | PASS | / | no dev badge on production | 0 badges |  |
| 21 | PASS | / | footer link targets respond 200 | /terms:200 /privacy:200 /refunds:200 /ai:200 /about:200 /guides:200 |  |
| 22 | PASS | /start | GET /start | 200 "Find out what registration needs from you \| Readyline" |  |
| 23 | PASS | /start | intro heading | h1: "Find out what registration needs from you" |  |
| 24 | PASS | /start | Start the questionnaire link | 1 link(s) -> /start/business |  |
| 25 | PASS | /start | glossary disclosure on intro | summary: "What these words mean (5)" |  |
| 26 | PASS | /start | no 'Continue where you left off' on a fresh device | count=0 |  |
| 27 | PASS | /start | storage note | "Your answers stay on this device as a draft until the last step. Sign in to keep them with your account instead. Do not enter any participant's details." |  |
| 28 | PASS | /start/business | step 1 heading | h1: "About your business" |  |
| 29 | PASS | /start/business | step indicator | "Step 1 of 6: Business" |  |
| 30 | PASS | /start/business | draft status line | "Your draft will be saved locally on this device after each step." |  |
| 31 | PASS | /start/business | validation on empty submit | url=https://readyline-zeta.vercel.app/start/business alerts: "Please fix the following before continuingTrading name: Enter your trading nameBusiness structure: Choose your business structureStates and territories: Choose at least one state or territory \|\| About your business" |  |
| 32 | PASS | /start/business | aria-invalid on failing fields | 2 elements aria-invalid |  |
| 33 | NOTE | /start/business | help hints shown on step 1 | "Step 1 of 6: Business" \| "The name participants and the Commission know you by. It appears on your documents." \| "Your structure changes a few audit questions; pick the one on your ABN record." \| "Where you deliver supports. Choose every state or territory that applies." \| "11 digits, spaces allowed. We check the format only; we do not look it up." \| "Your draft will be saved locally on this device after each step." |  |
| 34 | NOTE | /start/business | trading name hint | The name participants and the Commission know you by. It appears on your documents. |  |
| 35 | PASS | /start/business | errors clear on change before resubmit (REQ-028 FR-3) | alerts now: "About your business" |  |
| 36 | PASS | /start/business | radio and checkbox tick via UI | Sole trader checked, NSW checked |  |
| 37 | PASS | /start/business | no horizontal overflow | sw=360 cw=360  |  |
| 38 | PASS | /start/supports | step 2 heading | h1: "The supports you deliver" |  |
| 39 | PASS | /start/supports | step indicator | "Step 2 of 6: Supports" |  |
| 40 | PASS | /start/supports | draft saved status after step 1 | "Draft saved locally on this device." |  |
| 41 | PASS | /start/supports | draft in localStorage | readyline.questionnaire.draft.v1={"answersVersion":1,"answers":{"business":{"tradingName":"Sunrise Supports","str |  |
| 42 | PASS | /start/supports | first tickable class within 950px of the top (clean render) | first checkbox y=915; headings data-open=true,true,false,false,false,false,false,false |  |
| 43 | PASS | /start/supports | phone stepper: line one plus a closed 'Show steps' disclosure | Show steps visible=true open=false circles visible=true |  |
| 44 | PASS | /start/supports | validation on empty submit | alerts: "Please fix the following before continuingWhat do you do for participants?: Choose at least one registration group \|\| The supports you deliver" |  |
| 45 | PASS | /start/supports | no aside landmark at 360 | complementary count=0 |  |
| 46 | PASS | /start/supports | hint collapsed to one line at 360 | summary h=44 "Not sure?" button hidden=true |  |
| 47 | PASS | /start/supports | hint opens on tap | hint text: "Most sole-trader support workers choose Assistance with daily personal activities and Household tasks." |  |
| 48 | PASS | /start/supports | glossary opens and its count matches the entries | "What these words mean (1)" entries=registration-group open=true |  |
| 49 | PASS | /start/supports | glossary attribution line | "Our plain words, not the Commission's; the sources are on the result page and in the guides." |  |
| 50 | PASS | /start/supports | 0107 lives under one collapsible heading | count=1 data-open=true heading="▾Personal care at home (3 classes)" |  |
| 51 | PASS | /start/supports | heading opens on tap/click | data-open=true |  |
| 52 | PASS | /start/supports | tick 0107 via its checkbox | label: "Assistance with daily personal activities0107site auditHands-on help with everyday personal activities such as showering, dressing, eating and getting around at home." checked=true |  |
| 53 | NOTE | /start/supports | chosen line under the form | "1 chosen: Assistance with daily personal activities" |  |
| 54 | PASS | /start/supports | no horizontal overflow | sw=360 cw=360  |  |
| 55 | PASS | /start/business | Back from step 2 keeps step 1 answers | trading name="Sunrise Supports" sole trader checked |  |
| 56 | NOTE | /start/supports | a tick made and then Back pressed without 'Save and continue' | 0107 still checked after Back + forward = false (Back is a plain link; the draft saves only on Save and continue, and no warning is shown) |  |
| 57 | PASS | /start/supports | Back from step 3 keeps the saved 0107 tick | checked=true |  |
| 58 | PASS | /start/supports | stepper marks step 2 current, step 1 a link | "Step 2 of 6: Supports" links: 1. Business: done, change it->/start/business |  |
| 59 | PASS | /start/practices | step 3 heading | h1: "Restrictive practices" |  |
| 60 | PASS | /start/practices | step indicator | "Step 3 of 6: Practices" |  |
| 61 | PASS | /start/practices | validation on empty submit | alerts: "Please fix the following before continuingRestrictive practices: Choose yes, no or not sure \|\| Restrictive practices" |  |
| 62 | NOTE | /start/practices | question and examples | legend: "Do you use, or plan to use, any of these with a participant?" examples: "locking a cupboard, door or gate to stop someone getting something or going some"; "holding someone, or using a belt or strap, to stop them moving"; "medicine given mainly to control behaviour" |  |
| 63 | PASS | /start/practices | question precedes the first example at 360 | legend y=488 example y=954 |  |
| 64 | PASS | /start/practices | choose No | No checked |  |
| 65 | PASS | /start/practices | reload mid-way stays on step 3 (draft in localStorage) | h1 "Restrictive practices", "Step 3 of 6: Practices" |  |
| 66 | NOTE | /start/practices | after reload, the unsaved 'No' on this step | No still checked=false (draft saves on Save and continue; an unsaved tick may be dropped by design) |  |
| 67 | PASS | /start | intro offers 'Continue where you left off' pointing at step 3 | count=1 href=/start/practices |  |
| 68 | PASS | /start/practices | no horizontal overflow | sw=360 cw=360  |  |
| 69 | PASS | /start/workforce | step 4 heading | h1: "Your workforce" |  |
| 70 | PASS | /start/workforce | step indicator | "Step 4 of 6: Workforce" |  |
| 71 | NOTE | /start/workforce | defaults note | "You said you are a sole trader, so we have filled in the usual answers. Change anything that is different for you." |  |
| 72 | NOTE | /start/workforce | prefilled values | workers="1" key personnel="1" type=text inputmode=decimal |  |
| 73 | PASS | /start/workforce | validation when workers is blank and screening unanswered | alerts: "Please fix the following before continuingNumber of workers: Enter the number of workers, counting yourselfWorker screening: Choose an answer about worker screening \|\| Your workforce" |  |
| 74 | PASS | /start/workforce | fill 3 workers, 1 key personnel, screening yes | workers=3 key=1 |  |
| 75 | PASS | /start/workforce | no horizontal overflow | sw=360 cw=360  |  |
| 76 | PASS | /start/existing | step 5 heading | h1: "What you already have" |  |
| 77 | PASS | /start/existing | step indicator | "Step 5 of 6: Already have" |  |
| 78 | PASS | /start/existing | submit is 'See my result' | count=1 |  |
| 79 | PASS | /start/existing | validation on empty submit | alerts: "Please fix the following before continuingWritten policies and procedures: Choose yes, no or not sureAn incident register: Choose yes, no or not sureA complaints register: Choose yes, no or not sureCurrent insurance certificates: Choose yes, no or not sureWorker induction and training records: Choose yes, no or not sure \|\| What you already have" |  |
| 80 | NOTE | /start/existing | the five questions | "Do you have: written policies and procedures?" \| "Do you have: an incident register?" \| "Do you have: a complaints register?" \| "Do you have: current insurance certificates?" \| "Do you have: worker induction and training records?" |  |
| 81 | PASS | /start/existing | answer No to all five | all five No checked |  |
| 82 | PASS | /start/existing | no horizontal overflow | sw=360 cw=360  |  |
| 83 | PASS | /start/result | result heading | h1: "Your result" |  |
| 84 | PASS | /start/result | step indicator | "Step 6 of 6: Result" |  |
| 85 | PASS | /start/result | audit kind is certification for 0107 | h2: "Your audit: certification" |  |
| 86 | PASS | /start/result | the audit kind's meaning under the heading | "An approved auditor reads your documents, visits where you work and talks to people." |  |
| 87 | PASS | /start/result | the chosen group is listed in the card | "Assistance with daily personal activities 0107" |  |
| 88 | PASS | /start/result | counts in the card | "Documents: 22" / "Registers: 5, you keep these as you go" / "Checklist: 40 items (27 above plus 13 about your workers, insurance and the audit)" |  |
| 89 | PASS | /start/result | ready line: full 'still to do' line and the pack sentence after answering No to everything | done rect=0 todo rect=1 (width 100); sentence "The pack drafts all 22 so they match; your checklist shows which to compare with what you have." |  |
| 90 | PASS | /start/result | no 'you said you have' clause when nothing is held | "Documents: 22" / "Registers: 5, you keep these as you go" |  |
| 91 | PASS | /start/result | checklist line's 'above' count equals documents + registers | 22 + 5 = 27; checklist line says 27 above: "Checklist: 40 items (27 above plus 13 about your workers, insurance and the audit)" |  |
| 92 | PASS | /start/result | primary button label and href when signed out | "Sign in to get ready" -> /sign-in?next=%2Fpath%2Fbefore-you-buy |  |
| 93 | PASS | /start/result | 'See the price' link | "See the price" -> /pricing#start |  |
| 94 | PASS | /start/result | no 'Next:' line in the card (D-2805) | count=0 |  |
| 95 | PASS | /start/result | general-information notice | "General information, not legal advice. Read the terms." |  |
| 96 | PASS | /start/result | draft status on result | "Draft saved locally on this device." |  |
| 97 | PASS | /start/result | primary button ends inside the first screen at 360 | button bottom=632 of 740 |  |
| 98 | PASS | /start/result | stepper is line one alone at 360 | circles hidden=true |  |
| 99 | PASS | /start/result | three sections exist | "Why this result (3 reasons, with sources)" \| "Documents you will need (22)" \| "Registers to keep (5)" |  |
| 100 | PASS | /start/result | sections closed on first visit at 360 | {"why":false,"documents":false,"registers":false} |  |
| 101 | PASS | /start/result | all three sections open after tapping their summaries | {"why":true,"documents":true,"registers":true} |  |
| 102 | PASS | /start/result | core module (24 standards) listed | count=1 "Core module (24 standards)The standards every registered provider is audited against: participants' rights, how your business is run, how supports are delivered" |  |
| 103 | PASS | /start/result | no verification module for certification | count=0 |  |
| 104 | PASS | /start/result | mid-term audit line | "Applies: about 18 months after registration, against the provider governance and operational management standards. Start preparing from month 12." |  |
| 105 | PASS | /start/result | reasons list with a source link | 3 reasons; first: "Every selected group (0107 Assistance with daily personal activities) is a higher-risk class that needs a certification audit. Registration groups or classes of support (audit type table)" |  |
| 106 | PASS | /start/result | reason sources point at the Commission in a new tab | https://www.ndiscommission.gov.au/provider-registration/apply-registration/registration-groups-or-classes-support target=_blank ; https://www.ndiscommission.gov.au/sites/default/files/2022-02/200312-registration-requirements-supports-and-services_0_0.pdf target=_blank ; https://www.ndiscommission.gov.au/provider-registration/apply-registration/types-audits target=_blank |  |
| 107 | PASS | /start/result | documents legend | "Your pack drafts every document below. Where you have one, keep yours or use ours. Where you need one, ours is your starting point. We asked about 3 of the documents below in the last step. The tags are your answers from the last step." |  |
| 108 | PASS | /start/result | checklist link in the documents section (signed out) | "Open these in your checklist" -> /sign-in?next=%2Fchecklist |  |
| 109 | PASS | /start/result | document groups incl. running the business and your workers | doc-group-running-the-business: Governance policyRisk management policy and registerContinuity of supports planConflict of \| doc-group-your-workers: Worker screening and recruitment procedureInduction and training procedure and register!Yo \| doc-group-participants-and-supports: Service agreement templateParticipant rights and choice policySafeguarding policyFeedback  \| doc-group-environment-and-safety: Medication management procedureMealtime management procedureWaste and infection control pr |  |
| 110 | PASS | /start/result | document groups show counts in their summaries | "Running the business (10: 2 you need)" \| "Your workers (3: 1 you need)" \| "Participants and supports (6)" \| "Environment and safety (3)" |  |
| 111 | PASS | /start/result | document rows equal the Documents count | 22 rows vs Documents: 22 |  |
| 112 | PASS | /start/result | sole trader line in 'Your workers' | "A sole trader needs the clearance in their own name.Check this against the Commission's page before you rely on it. Worker Screening Rules s 13(c), with few exceptions. NDIS Worker Screening Check (NDIS Commission)" |  |
| 113 | PASS | /start/result | have tags are the reader's answers | 6 tags; distinct: !You need one |  |
| 114 | NOTE | /start/result | registers legend | "Your pack includes a template for every register below; the subscription keeps them for you. An auditor samples them at the mid-term audit and at renewal." |  |
| 115 | PASS | /start/result | registers section lists the counted registers | 5 rows vs "Registers: 5": "Incident register!You need one"; "Complaints register!You need one"; "Worker screening clearance register"; "Training register!You need one"; "Policy review register" |  |
| 116 | PASS | /start/result | 'What happens next' block | "What happens nextReadyline drafts these documents as a one-off pack; the registers follow as a subscription. Go to your documents if you already have one." |  |
| 117 | NOTE | /start/result | two-halves block (pack/subscription) | "What keeps you audit-readyThe registers and reminders, a monthly subscription that keeps your evidence in one place for renewal. The subscription.Where you startThe document pack, one price paid once; nothing is bundled and nothing is discounted. The pack." |  |
| 118 | NOTE | /start/result | subscription-off marker | count=0 |  |
| 119 | PASS | /start/result | section open/closed state remembered after reload | before={"why":false,"documents":true,"registers":true} stored=["documents","registers","doc-group-your-workers"] after={"why":false,"documents":true,"registers":true} |  |
| 120 | PASS | /start/result | layout shift over the first 2s after load (reload) | CLS total=0.0000 entries=[] |  |
| 121 | PASS | /start/result | 'Change my answers' href | -> /start/business |  |
| 122 | PASS | /start/business | 'Change my answers' lands on step 1 with answers kept | trading="Sunrise Supports" "Step 1 of 6: Business" |  |
| 123 | NOTE | /start/business | after 'Change my answers' the stepper offers no way back to the result | stepper links: (none); list reads "1. Business: current2. Supports: not yet3. Practices: not yet4. Workforce: not yet5. Already have: not yet6. Result: not yet" |  |
| 124 | NOTE | /start/business | 'Save and continue' on step 1 after 'Change my answers' goes to | https://readyline-zeta.vercel.app/start/supports |  |
| 125 | PASS | /start | intro's 'Continue where you left off' points at the result once reached | href=/start/result |  |
| 126 | PASS | /start/result | the result is reachable directly while the draft is complete | https://readyline-zeta.vercel.app/start/result |  |
| 127 | PASS | /start/result | 'Start again' control in the card | "Start again" |  |
| 128 | PASS | /start/result | 'Start again' asks to confirm | confirm button count=1 dialog text: "Clear your answers and start again? Your result goes with them.KeepYes, start againWhat these words mean (5)Our plain words, not the Commission's; the sources are linked under each reason." |  |
| 129 | PASS | /start | 'Start again' clears the draft and lands on the intro | localStorage: readyline.result.open=["documents","registers","doc-group-your-workers"]; continue link count=0 |  |
| 130 | PASS | /start/result | result unreachable after clearing (redirects to step 1) | landed on https://readyline-zeta.vercel.app/start/business |  |
| 131 | PASS | /pricing | GET /pricing and h1 | 200 h1 "Pricing" |  |
| 132 | PASS | /pricing | subscription card heading | "Registers subscription" |  |
| 133 | NOTE | /pricing | pack card h2 reads | "Price" (card eyebrow: "Where you startPriceAUD 399 one-off, for the document packA ") |  |
| 134 | PASS | /pricing | the two prices | sub "AUD 39" pack "AUD 399" |  |
| 135 | PASS | /pricing | pack card's three bullets | "A draft of every document your registration groups call for" \| "Written from your answers; you review and adopt each one" \| "Download as one file (zip), yours to keep" |  |
| 136 | PASS | /pricing | both buttons secondary, nothing primary in the cards | primary count=0; sign-in-to-buy class="btn-secondary" |  |
| 137 | NOTE | /pricing | buttons inside the cards | A "Sign in to buy" -> /sign-in?next=%2Fpricing |  |
| 138 | PASS | /pricing | pack sign-in link href | -> /sign-in?next=%2Fpricing |  |
| 139 | PASS | /pricing | subscription offer, signed out: no subscribe button | "AUD 39 a month for the registers, with email reminders.Incident registerComplaints registerWorker checks, with expiry remindersPolicy review remindersCancel at any time; no notice period, no fee, no instalments, no interest." subscribe-button count=0 |  |
| 140 | PASS | /pricing | 'Sign in to subscribe' shown signed out | count=1 |  |
| 141 | PASS | /pricing | no urgency words | matches: none |  |
| 142 | PASS | /pricing | the one no-credit line | "No instalments, no interest, no late fees." |  |
| 143 | PASS | /pricing | no-credit line sits under both cards | halves bottom=1546 line y=1558 |  |
| 144 | PASS | /pricing | GST line | "No GST is charged while Readyline is not registered for GST." |  |
| 145 | PASS | /pricing | refund promise | "We want you to be happy with what you buy. If you are not, tell us and we will put it right or refund you as set out below.You can have a full refund within 14 days of buying the pack if you have not " |  |
| 146 | PASS | /pricing | link 'Terms of use' | count=1 -> /terms |  |
| 147 | PASS | /pricing | link 'Privacy policy' | count=1 -> /privacy |  |
| 148 | PASS | /pricing | link 'Refunds page' | count=1 -> /refunds |  |
| 149 | PASS | /pricing | AI disclosure and not-legal-advice notice | both present |  |
| 150 | PASS | /pricing | no pre-ticked checkboxes | 0 checkboxes |  |
| 151 | PASS | /pricing | no horizontal overflow | sw=360 cw=360  |  |
| 152 | PASS | /pricing | anchors #start and #keeps exist for the home strip links | #start:found #keeps:found |  |
| 153 | PASS | /sign-in | sign-in page loads (read only, not submitted) | 200 h1 "Sign in" |  |
| 154 | NOTE | /sign-in | form controls present (not touched) | INPUT:text:email, BUTTON:submit:Email me a sign-in link |  |

### Viewport 1280x800

| # | Status | Page | Check | What I saw | Shot |
|---:|---|---|---|---|---|
| 1 | PASS | / | GET / status | 200, title "Readyline: registration-readiness for small NDIS providers" |  |
| 2 | PASS | / | h1 asks the audit question and names the price | h1: "Find out which NDIS audit you'll face — free. Then get every document it needs, drafted from your answers, for AUD 399." |  |
| 3 | PASS | / | section headings present | h2: "What a result looks like", "See exactly what you get", "What you can count on", "Why one price, and who is behind it" |  |
| 4 | PASS | / | primary CTA label and href | "See which audit I need" -> /start |  |
| 5 | PASS | / | primary CTA is inside the first screen | CTA bottom at 540px of 800px |  |
| 6 | PASS | / | primary CTA uses the primary style | class="btn-primary" |  |
| 7 | PASS | / | free line | "Free, about ten minutes, no account needed." |  |
| 8 | PASS | / | price strip cell 1 (registers) | "Registers subscription · AUD 39 a month" -> /pricing#keeps |  |
| 9 | PASS | / | price strip cell 2 (pack) | "Document pack · AUD 399 one-off" -> /pricing#start |  |
| 10 | PASS | / | price strip cells one size and weight | [{"size":"16px","weight":"400","nums":"tabular-nums"},{"size":"16px","weight":"400","nums":"tabular-nums"}] |  |
| 11 | PASS | / | price strip cells side by side at 1280 | registers x=96 y=588; pack x=411 y=588 |  |
| 12 | PASS | / | price line under strip | "Where you start: AUD 399 one-off for the document pack. No subscription needed, no instalments, no interest. Full refund within 14 days if you have not downloaded the documents; after a download, a refund if they do not match your answers. Refunds." |  |
| 13 | PASS | / | subscription line under strip | "What keeps you audit-ready: AUD 39 a month keeps you audit-ready: the registers, the reminders and the mid-term audit countdown, so your evidence sits in one place when renewal comes. Cancel at any time." |  |
| 14 | PASS | / | example result card present | "What a result looks likeA sole trader in New South Wales delivering household tasks (class 0120):Your audit: verification. You will need 15 documents and 5 registers. An approved auditor checks your documents without com..." |  |
| 15 | PASS | / | example card ready line | "0 of 20 documents and registers in place, 20 still to do." |  |
| 16 | PASS | / | example card beside the hero in 5 columns at 1280 | h1 right=717; example x=749 w=435 (expected 435), y=117 vs h1 bottom 356 |  |
| 17 | PASS | / | four trust cards | 4 cards: Sourced to the Commission. Every module, standard and audit  \| Hosted in Australia. Your business details stay in an Austra \| No participant data. Readyline never asks for participants'  \| Independent. Not affiliated with the NDIA or the Commission, |  |
| 18 | PASS | / | trust cards 2 x 2 at 1280 | (96,1259) (648,1259) (96,1421) (648,1421) |  |
| 19 | PASS | / | footer links | Terms -> /terms, Privacy -> /privacy, Refunds -> /refunds, How we use AI -> /ai, About -> /about, Guides -> /guides, Contact -> mailto:haiderali14se89@gmail.com |  |
| 20 | PASS | / | no horizontal overflow | scrollWidth=1280 clientWidth=1280 offenders=none |  |
| 21 | PASS | / | no dev badge on production | 0 badges |  |
| 22 | PASS | / | footer link targets respond 200 | /terms:200 /privacy:200 /refunds:200 /ai:200 /about:200 /guides:200 |  |
| 23 | PASS | /start | GET /start | 200 "Find out what registration needs from you \| Readyline" |  |
| 24 | PASS | /start | intro heading | h1: "Find out what registration needs from you" |  |
| 25 | PASS | /start | Start the questionnaire link | 1 link(s) -> /start/business |  |
| 26 | PASS | /start | glossary disclosure on intro | summary: "What these words mean (5)" |  |
| 27 | PASS | /start | no 'Continue where you left off' on a fresh device | count=0 |  |
| 28 | PASS | /start | storage note | "Your answers stay on this device as a draft until the last step. Sign in to keep them with your account instead. Do not enter any participant's details." |  |
| 29 | PASS | /start/business | step 1 heading | h1: "About your business" |  |
| 30 | PASS | /start/business | step indicator | "Step 1 of 6: Business" |  |
| 31 | PASS | /start/business | draft status line | "Your draft will be saved locally on this device after each step." |  |
| 32 | PASS | /start/business | validation on empty submit | url=https://readyline-zeta.vercel.app/start/business alerts: "Please fix the following before continuingTrading name: Enter your trading nameBusiness structure: Choose your business structureStates and territories: Choose at least one state or territory \|\| About your business \| Readyline" |  |
| 33 | PASS | /start/business | aria-invalid on failing fields | 2 elements aria-invalid |  |
| 34 | NOTE | /start/business | help hints shown on step 1 | "Step 1 of 6: Business" \| "The name participants and the Commission know you by. It appears on your documents." \| "Your structure changes a few audit questions; pick the one on your ABN record." \| "Where you deliver supports. Choose every state or territory that applies." \| "11 digits, spaces allowed. We check the format only; we do not look it up." \| "Your draft will be saved locally on this device after each step." |  |
| 35 | NOTE | /start/business | trading name hint | The name participants and the Commission know you by. It appears on your documents. |  |
| 36 | PASS | /start/business | errors clear on change before resubmit (REQ-028 FR-3) | alerts now: "About your business \| Readyline" |  |
| 37 | PASS | /start/business | radio and checkbox tick via UI | Sole trader checked, NSW checked |  |
| 38 | PASS | /start/business | no horizontal overflow | sw=1280 cw=1280  |  |
| 39 | PASS | /start/supports | step 2 heading | h1: "The supports you deliver" |  |
| 40 | PASS | /start/supports | step indicator | "Step 2 of 6: Supports" |  |
| 41 | PASS | /start/supports | draft saved status after step 1 | "Draft saved locally on this device." |  |
| 42 | PASS | /start/supports | draft in localStorage | readyline.questionnaire.draft.v1={"answersVersion":1,"answers":{"business":{"tradingName":"Sunrise Supports","str |  |
| 43 | PASS | /start/supports | laptop stepper: circles with labels, no 'Show steps' control | circles visible=true labels visible=true Show steps visible=false |  |
| 44 | PASS | /start/supports | validation on empty submit | alerts: "Please fix the following before continuingWhat do you do for participants?: Choose at least one registration group \|\| The supports you deliver" |  |
| 45 | PASS | /start/supports | aside landmark 'Help for this step' at 1280 | visible=true |  |
| 46 | PASS | /start/supports | aside order: hint, glossary, Ticked so far, beside the form | form right=717 hint(843,298) glossary y=472 ticked y=537 |  |
| 47 | NOTE | /start/supports | aside hint text | "Not sure? Most sole-trader support workers choose Assistance with daily personal activities and Household tasks.Choose those two for me" |  |
| 48 | PASS | /start/supports | 'Ticked so far (0)' before any tick | "Ticked so far (0)Nothing chosen yet." |  |
| 49 | PASS | /start/supports | glossary opens and its count matches the entries | "What these words mean (2)" entries=registration-group,restrictive-practice open=true |  |
| 50 | PASS | /start/supports | glossary attribution line | "Our plain words, not the Commission's; the sources are on the result page and in the guides." |  |
| 51 | PASS | /start/supports | 0107 lives under one collapsible heading | count=1 data-open=true heading="▾Personal care at home (3 classes)" |  |
| 52 | PASS | /start/supports | heading opens on tap/click | data-open=true |  |
| 53 | PASS | /start/supports | tick 0107 via its checkbox | label: "Assistance with daily personal activities0107site auditHands-on help with everyday personal activities such as showering, dressing, eating and getting around at home." checked=true |  |
| 54 | PASS | /start/supports | 'Ticked so far (1)' and the audit line after one tick | "Ticked so far (1)Assistance with daily personal activitiesRemove1 site audit" / count line: "1 site audit" |  |
| 55 | PASS | /start/supports | class rows two columns at 1280 | row0 (109,604) row1 (411,604) |  |
| 56 | NOTE | /start/supports | chosen line under the form | "1 chosen: Assistance with daily personal activities" |  |
| 57 | PASS | /start/supports | no horizontal overflow | sw=1280 cw=1280  |  |
| 58 | PASS | /start/business | Back from step 2 keeps step 1 answers | trading name="Sunrise Supports" sole trader checked |  |
| 59 | NOTE | /start/supports | a tick made and then Back pressed without 'Save and continue' | 0107 still checked after Back + forward = false (Back is a plain link; the draft saves only on Save and continue, and no warning is shown) |  |
| 60 | PASS | /start/supports | Back from step 3 keeps the saved 0107 tick | checked=true |  |
| 61 | PASS | /start/supports | stepper marks step 2 current, step 1 a link | "Step 2 of 6: Supports" links: 1. Business: done, change it->/start/business |  |
| 62 | PASS | /start/practices | step 3 heading | h1: "Restrictive practices" |  |
| 63 | PASS | /start/practices | step indicator | "Step 3 of 6: Practices" |  |
| 64 | PASS | /start/practices | validation on empty submit | alerts: "Please fix the following before continuingRestrictive practices: Choose yes, no or not sure \|\| Restrictive practices" |  |
| 65 | NOTE | /start/practices | question and examples | legend: "Do you use, or plan to use, any of these with a participant?" examples: "locking a cupboard, door or gate to stop someone getting something or going some"; "holding someone, or using a belt or strap, to stop them moving"; "medicine given mainly to control behaviour" |  |
| 66 | PASS | /start/practices | choose No | No checked |  |
| 67 | PASS | /start/practices | reload mid-way stays on step 3 (draft in localStorage) | h1 "Restrictive practices", "Step 3 of 6: Practices" |  |
| 68 | NOTE | /start/practices | after reload, the unsaved 'No' on this step | No still checked=false (draft saves on Save and continue; an unsaved tick may be dropped by design) |  |
| 69 | PASS | /start | intro offers 'Continue where you left off' pointing at step 3 | count=1 href=/start/practices |  |
| 70 | PASS | /start/practices | no horizontal overflow | sw=1280 cw=1280  |  |
| 71 | PASS | /start/workforce | step 4 heading | h1: "Your workforce" |  |
| 72 | PASS | /start/workforce | step indicator | "Step 4 of 6: Workforce" |  |
| 73 | NOTE | /start/workforce | defaults note | "You said you are a sole trader, so we have filled in the usual answers. Change anything that is different for you." |  |
| 74 | NOTE | /start/workforce | prefilled values | workers="1" key personnel="1" type=text inputmode=decimal |  |
| 75 | PASS | /start/workforce | validation when workers is blank and screening unanswered | alerts: "Please fix the following before continuingNumber of workers: Enter the number of workers, counting yourselfWorker screening: Choose an answer about worker screening \|\| Your workforce" |  |
| 76 | PASS | /start/workforce | fill 3 workers, 1 key personnel, screening yes | workers=3 key=1 |  |
| 77 | PASS | /start/workforce | no horizontal overflow | sw=1280 cw=1280  |  |
| 78 | PASS | /start/existing | step 5 heading | h1: "What you already have" |  |
| 79 | PASS | /start/existing | step indicator | "Step 5 of 6: Already have" |  |
| 80 | PASS | /start/existing | submit is 'See my result' | count=1 |  |
| 81 | PASS | /start/existing | validation on empty submit | alerts: "Please fix the following before continuingWritten policies and procedures: Choose yes, no or not sureAn incident register: Choose yes, no or not sureA complaints register: Choose yes, no or not sureCurrent insurance certificates: Choose yes, no or not sureWorker induction and training records: Choose yes, no or not sure \|\| What you already have" |  |
| 82 | NOTE | /start/existing | the five questions | "Do you have: written policies and procedures?" \| "Do you have: an incident register?" \| "Do you have: a complaints register?" \| "Do you have: current insurance certificates?" \| "Do you have: worker induction and training records?" |  |
| 83 | PASS | /start/existing | answer No to all five | all five No checked |  |
| 84 | PASS | /start/existing | no horizontal overflow | sw=1280 cw=1280  |  |
| 85 | PASS | /start/result | result heading | h1: "Your result" |  |
| 86 | PASS | /start/result | step indicator | "Step 6 of 6: Result" |  |
| 87 | PASS | /start/result | audit kind is certification for 0107 | h2: "Your audit: certification" |  |
| 88 | PASS | /start/result | the audit kind's meaning under the heading | "An approved auditor reads your documents, visits where you work and talks to people." |  |
| 89 | PASS | /start/result | the chosen group is listed in the card | "Assistance with daily personal activities 0107" |  |
| 90 | PASS | /start/result | counts in the card | "Documents: 22" / "Registers: 5, you keep these as you go" / "Checklist: 40 items (27 above plus 13 about your workers, insurance and the audit)" |  |
| 91 | PASS | /start/result | ready line: full 'still to do' line and the pack sentence after answering No to everything | done rect=0 todo rect=1 (width 100); sentence "The pack drafts all 22 so they match; your checklist shows which to compare with what you have." |  |
| 92 | PASS | /start/result | no 'you said you have' clause when nothing is held | "Documents: 22" / "Registers: 5, you keep these as you go" |  |
| 93 | PASS | /start/result | checklist line's 'above' count equals documents + registers | 22 + 5 = 27; checklist line says 27 above: "Checklist: 40 items (27 above plus 13 about your workers, insurance and the audit)" |  |
| 94 | PASS | /start/result | primary button label and href when signed out | "Sign in to get ready" -> /sign-in?next=%2Fpath%2Fbefore-you-buy |  |
| 95 | PASS | /start/result | 'See the price' link | "See the price" -> /pricing#start |  |
| 96 | PASS | /start/result | no 'Next:' line in the card (D-2805) | count=0 |  |
| 97 | PASS | /start/result | general-information notice | "General information, not legal advice. Read the terms." |  |
| 98 | PASS | /start/result | draft status on result | "Draft saved locally on this device." |  |
| 99 | PASS | /start/result | three sections exist | "Why this result (3 reasons, with sources)" \| "Documents you will need (22)" \| "Registers to keep (5)" |  |
| 100 | PASS | /start/result | sections open on first visit at 1280 | {"why":true,"documents":true,"registers":true} |  |
| 101 | PASS | /start/result | card 5 columns, sections 7 columns beside it | card w=435 (exp 435); sections x=563 w=621 (exp 621) |  |
| 102 | PASS | /start/result | card sticky at 6rem after a scroll | card y=96 after scrollTo 900 |  |
| 103 | PASS | /start/result | all three sections open after tapping their summaries | {"why":true,"documents":true,"registers":true} |  |
| 104 | PASS | /start/result | core module (24 standards) listed | count=1 "Core module (24 standards)The standards every registered provider is audited against: participants' rights, how your business is run, how supports are delivered" |  |
| 105 | PASS | /start/result | no verification module for certification | count=0 |  |
| 106 | PASS | /start/result | mid-term audit line | "Applies: about 18 months after registration, against the provider governance and operational management standards. Start preparing from month 12." |  |
| 107 | PASS | /start/result | reasons list with a source link | 3 reasons; first: "Every selected group (0107 Assistance with daily personal activities) is a higher-risk class that needs a certification audit. Registration groups or classes of support (audit type table)" |  |
| 108 | PASS | /start/result | reason sources point at the Commission in a new tab | https://www.ndiscommission.gov.au/provider-registration/apply-registration/registration-groups-or-classes-support target=_blank ; https://www.ndiscommission.gov.au/sites/default/files/2022-02/200312-registration-requirements-supports-and-services_0_0.pdf target=_blank ; https://www.ndiscommission.gov.au/provider-registration/apply-registration/types-audits target=_blank |  |
| 109 | PASS | /start/result | documents legend | "Your pack drafts every document below. Where you have one, keep yours or use ours. Where you need one, ours is your starting point. We asked about 3 of the documents below in the last step. The tags are your answers from the last step." |  |
| 110 | PASS | /start/result | checklist link in the documents section (signed out) | "Open these in your checklist" -> /sign-in?next=%2Fchecklist |  |
| 111 | PASS | /start/result | document groups incl. running the business and your workers | doc-group-running-the-business: Governance policyRisk management policy and registerContinuity of supports planConflict of \| doc-group-your-workers: Worker screening and recruitment procedureInduction and training procedure and register!Yo \| doc-group-participants-and-supports: Service agreement templateParticipant rights and choice policySafeguarding policyFeedback  \| doc-group-environment-and-safety: Medication management procedureMealtime management procedureWaste and infection control pr |  |
| 112 | PASS | /start/result | document groups show counts in their summaries | "Running the business (10: 2 you need)" \| "Your workers (3: 1 you need)" \| "Participants and supports (6)" \| "Environment and safety (3)" |  |
| 113 | PASS | /start/result | document rows equal the Documents count | 22 rows vs Documents: 22 |  |
| 114 | PASS | /start/result | sole trader line in 'Your workers' | "A sole trader needs the clearance in their own name.Check this against the Commission's page before you rely on it. Worker Screening Rules s 13(c), with few exceptions. NDIS Worker Screening Check (NDIS Commission)" |  |
| 115 | PASS | /start/result | have tags are the reader's answers | 6 tags; distinct: !You need one |  |
| 116 | NOTE | /start/result | registers legend | "Your pack includes a template for every register below; the subscription keeps them for you. An auditor samples them at the mid-term audit and at renewal." |  |
| 117 | PASS | /start/result | registers section lists the counted registers | 5 rows vs "Registers: 5": "Incident register!You need one"; "Complaints register!You need one"; "Worker screening clearance register"; "Training register!You need one"; "Policy review register" |  |
| 118 | PASS | /start/result | 'What happens next' block | "What happens nextReadyline drafts these documents as a one-off pack; the registers follow as a subscription. Go to your documents if you already have one." |  |
| 119 | NOTE | /start/result | two-halves block (pack/subscription) | "What keeps you audit-readyThe registers and reminders, a monthly subscription that keeps your evidence in one place for renewal. The subscription.Where you startThe document pack, one price paid once; nothing is bundled and nothing is discounted. The pack." |  |
| 120 | NOTE | /start/result | subscription-off marker | count=0 |  |
| 121 | PASS | /start/result | section open/closed state remembered after reload | before={"why":false,"documents":true,"registers":true} stored=["documents","registers","doc-group-your-workers"] after={"why":false,"documents":true,"registers":true} |  |
| 122 | PASS | /start/result | layout shift over the first 2s after load (reload) | CLS total=0.0000 entries=[] |  |
| 123 | PASS | /start/result | 'Change my answers' href | -> /start/business |  |
| 124 | PASS | /start/business | 'Change my answers' lands on step 1 with answers kept | trading="Sunrise Supports" "Step 1 of 6: Business" |  |
| 125 | NOTE | /start/business | after 'Change my answers' the stepper offers no way back to the result | stepper links: (none); list reads "1. Business: current2. Supports: not yet3. Practices: not yet4. Workforce: not yet5. Already have: not yet6. Result: not yet" |  |
| 126 | NOTE | /start/business | 'Save and continue' on step 1 after 'Change my answers' goes to | https://readyline-zeta.vercel.app/start/supports |  |
| 127 | PASS | /start | intro's 'Continue where you left off' points at the result once reached | href=/start/result |  |
| 128 | PASS | /start/result | the result is reachable directly while the draft is complete | https://readyline-zeta.vercel.app/start/result |  |
| 129 | PASS | /start/result | 'Start again' control in the card | "Start again" |  |
| 130 | PASS | /start/result | 'Start again' asks to confirm | confirm button count=1 dialog text: "Clear your answers and start again? Your result goes with them.KeepYes, start againWhat these words mean (5)Our plain words, not the Commission's; the sources are linked under each reason." |  |
| 131 | PASS | /start | 'Start again' clears the draft and lands on the intro | localStorage: readyline.result.open=["documents","registers","doc-group-your-workers"]; continue link count=0 |  |
| 132 | PASS | /start/result | result unreachable after clearing (redirects to step 1) | landed on https://readyline-zeta.vercel.app/start/business |  |
| 133 | PASS | /pricing | GET /pricing and h1 | 200 h1 "Pricing" |  |
| 134 | PASS | /pricing | subscription card heading | "Registers subscription" |  |
| 135 | NOTE | /pricing | pack card h2 reads | "Price" (card eyebrow: "Where you startPriceAUD 399 one-off, for the document packA ") |  |
| 136 | PASS | /pricing | the two prices | sub "AUD 39" pack "AUD 399" |  |
| 137 | PASS | /pricing | pack card's three bullets | "A draft of every document your registration groups call for" \| "Written from your answers; you review and adopt each one" \| "Download as one file (zip), yours to keep" |  |
| 138 | PASS | /pricing | both buttons secondary, nothing primary in the cards | primary count=0; sign-in-to-buy class="btn-secondary" |  |
| 139 | NOTE | /pricing | buttons inside the cards | A "Sign in to buy" -> /sign-in?next=%2Fpricing |  |
| 140 | PASS | /pricing | pack sign-in link href | -> /sign-in?next=%2Fpricing |  |
| 141 | PASS | /pricing | subscription offer, signed out: no subscribe button | "AUD 39 a month for the registers, with email reminders.Incident registerComplaints registerWorker checks, with expiry remindersPolicy review remindersCancel at any time; no notice period, no fee, no instalments, no interest." subscribe-button count=0 |  |
| 142 | PASS | /pricing | 'Sign in to subscribe' shown signed out | count=1 |  |
| 143 | PASS | /pricing | no urgency words | matches: none |  |
| 144 | PASS | /pricing | the one no-credit line | "No instalments, no interest, no late fees." |  |
| 145 | PASS | /pricing | no-credit line sits under both cards | halves bottom=838 line y=850 |  |
| 146 | PASS | /pricing | GST line | "No GST is charged while Readyline is not registered for GST." |  |
| 147 | PASS | /pricing | refund promise | "We want you to be happy with what you buy. If you are not, tell us and we will put it right or refund you as set out below.You can have a full refund within 14 days of buying the pack if you have not " |  |
| 148 | PASS | /pricing | link 'Terms of use' | count=1 -> /terms |  |
| 149 | PASS | /pricing | link 'Privacy policy' | count=1 -> /privacy |  |
| 150 | PASS | /pricing | link 'Refunds page' | count=1 -> /refunds |  |
| 151 | PASS | /pricing | AI disclosure and not-legal-advice notice | both present |  |
| 152 | PASS | /pricing | two cards equal height side by side at 1280 | sub 443x504 @y335; pack 443x504 @y335 |  |
| 153 | PASS | /pricing | no pre-ticked checkboxes | 0 checkboxes |  |
| 154 | PASS | /pricing | no horizontal overflow | sw=1280 cw=1280  |  |
| 155 | PASS | /pricing | anchors #start and #keeps exist for the home strip links | #start:found #keeps:found |  |
| 156 | PASS | /sign-in | sign-in page loads (read only, not submitted) | 200 h1 "Sign in" |  |
| 157 | NOTE | /sign-in | form controls present (not touched) | INPUT:text:email, BUTTON:submit:Email me a sign-in link |  |

## Console and network, per page

### 360x740

Console errors/warnings/pageerrors: none on any page.

Failed or ≥400 requests, excluding `_rsc=` prefetch aborts:

- https://readyline-zeta.vercel.app/:
  - FAILED GET https://readyline-zeta.vercel.app/guides net::ERR_ABORTED
  - FAILED GET https://readyline-zeta.vercel.app/about net::ERR_ABORTED
  - FAILED GET https://readyline-zeta.vercel.app/ai net::ERR_ABORTED
  - FAILED GET https://readyline-zeta.vercel.app/privacy net::ERR_ABORTED
  - FAILED GET https://readyline-zeta.vercel.app/terms net::ERR_ABORTED
  - FAILED GET https://readyline-zeta.vercel.app/refunds net::ERR_ABORTED
- https://readyline-zeta.vercel.app/start/result:
  - FAILED POST https://readyline-zeta.vercel.app/start/result net::ERR_ABORTED

No request returned a 4xx or 5xx status on any page.

### 1280x800

Console errors/warnings/pageerrors: none on any page.

Failed or ≥400 requests, excluding `_rsc=` prefetch aborts:

- https://readyline-zeta.vercel.app/:
  - FAILED GET https://readyline-zeta.vercel.app/terms net::ERR_ABORTED
  - FAILED GET https://readyline-zeta.vercel.app/refunds net::ERR_ABORTED
  - FAILED GET https://readyline-zeta.vercel.app/ai net::ERR_ABORTED
  - FAILED GET https://readyline-zeta.vercel.app/guides net::ERR_ABORTED
  - FAILED GET https://readyline-zeta.vercel.app/privacy net::ERR_ABORTED
  - FAILED GET https://readyline-zeta.vercel.app/about net::ERR_ABORTED
- https://readyline-zeta.vercel.app/start/result:
  - FAILED POST https://readyline-zeta.vercel.app/start/result net::ERR_ABORTED

No request returned a 4xx or 5xx status on any page.

