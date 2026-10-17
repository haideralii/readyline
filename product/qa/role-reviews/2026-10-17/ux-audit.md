# Readyline UI/UX audit (designer and researcher role, 17 Oct 2026)

Run by the PO's UI/UX designer-and-researcher role on Haider's ask of 17 Oct 2026 ("it should be better for desktop as well; zip files are downloaded on laptops"). The screenshots (226 PNGs at 360, 768, 1280 and 1536 px, light and dark) and the axe output stay in the audit folder; the findings cite files and lines so the Dev can see each one in the code. The PO turns the accepted items into a requirement.

Audited: branch `origin/req-027-session-a2` at commit 9204f48, built with `npm run build` and served with `npm start` (STRIPE_FAKE=1, no Supabase). Date: 17 October 2026.

Screenshots: `<audit folder, not committed>/shots/` (226 files, `<route>-<width>-<scheme>.png`, plus `crop-*` details). Harness: `<audit folder, not committed>/app/scripts/ux-shoot.mjs` (my own file in the working copy; nothing committed). axe output: `../axe.json`; layout metrics: `../metrics.json`; contrast calculator: `../contrast.py`.

---

## 1. Method

**Rendered and screenshotted** (full page, Chromium, `prefers-color-scheme` light and dark, widths 360, 768, 1280 and 1536 px):

- `/`, `/start`, `/start/business`, `/sample`, `/pricing`, `/guides`, `/guides/which-ndis-audit`, `/guides/registration-groups`, `/terms`, `/privacy`, `/refunds`, `/ai`, `/about`, `/sign-in` (viewed only), and a 404 page.
- The questionnaire, filled with fictional answers (trading name "Sunrise Supports", NSW, class 0107): step 1 submitted empty (error state) and filled, step 2 (supports), step 3 (practices, plus the "Not sure" helper open), step 4 (workforce), step 5 (already have), the result page closed and with every disclosure open. Run once as Sole trader at all widths and schemes, and again as Company (Pty Ltd) at 360 and 1280 light (`*-company-*.png`).
- Viewport-only shots of the first screen ("fold") of home and pricing at 360 and 1280; the skip link and the fourth Tab stop on home.
- axe-core 4 with WCAG 2.0/2.1/2.2 A and AA tags on every public page and every questionnaire step at 360 and 1280 px in both schemes: **zero violations** everywhere. The contrast failures below were therefore measured by hand (WCAG 2.x relative-luminance formula, `contrast.py`), on states axe did not render (empty search result, dark-mode-only classes, decorative borders, non-text UI boundaries) or on things axe does not test (1.4.11 non-text contrast on borders).

**Read from source and committed evidence only** (they need Supabase): documents (`src/app/documents/**`), registers (`src/app/registers/**`), audit pack (`src/app/registers/page.tsx`, `audit-pack.zip/route.ts`), checklist (`src/app/checklist/checklist-view.tsx`), guided path (`src/app/path/**`), account (`src/app/account/page.tsx`), worker pages, and the committed CI screenshots under `product/evidence/req-006`, `req-007`, `req-009`, `req-015`, `req-021`, `req-027` (desktop 1280 px and 360 px; the registers set was captured 15 Oct and predates the ten registers added since).

**Judged against**: REQ-014 (tokens, serif, the line motif), REQ-013, REQ-015 (fold rule, one primary action, feedback), REQ-027 D-2701 to D-2729 (glossary disclosure, result card order, 360 × 740 fold), `product/domain/brand.md`, `product/domain/ui-copy.md`, `CLAUDE.md` 4.1 to 4.5 and 5 (no urgency, no dark patterns, independence), and general craft.

**Widths referred to below**: "phone" is 360 × 740, "laptop" is 1280 × 900 and 1536 × 900 (identical layouts; nothing changes above 1024 px).

---

## 2. Findings (most important first)

Severity: **bug** (wrong behaviour), **major** (hurts the task or the brand on a whole page class), **minor** (visible flaw, local), **polish** (craft).

### A. Desktop layout and width use

**1. major: Every page is a 624 px column; a laptop shows a wide phone.**
Where: every page container, `max-w-2xl` in 39 places (`src/app/pricing/page.tsx:80`, `src/app/start/_components/step-shell.tsx:45`, `src/app/documents/page.tsx:307`, `src/app/registers/_components/shell.tsx:59`, `src/app/account/page.tsx:139`, `src/app/guides/[slug]/page.tsx:70`, `src/app/checklist/*`, and so on); header and footer are `max-w-5xl` (`src/components/site-header.tsx:109`, `site-footer.tsx:183`).
What: at 1280 and 1536 px the content column is 624 px (672 minus 48 px padding) and the layout does not change between 1024 and 1536 px. The supports step is 5,957 px tall at 1280 px (`shots/q2-supports-1280-light.png`), the open result page 5,075 px, the which-audit guide 6,665 px; the right half of the screen is empty on all of them. The header's "Sign in" sits 176 px to the right of the content's right edge, so the header, the content and the footer do not share an edge.
Why: documents, registers, the audit-pack zip and the long reading pages are laptop tasks; a 38-row checklist in one 624 px column is 3 to 4 screens of scrolling that a two-column layout removes.
Fix: see section 3. In short: one shell container (`max-w-6xl`, 1152 px, `px-6 lg:px-8`) shared by header, main and footer; inside it, from `lg` (1024 px) a 12-column grid: reading pages 8/12 with a 3/12 aside, forms 7/12 with a 4/12 help aside, lists and registers full 12/12.
Screenshot: `shots/home-1280-light.png`, `shots/q2-supports-1280-light.png`, `shots/pricing-1280-light.png`.

**2. major: The home page is the only page whose column is left-aligned; the others are centred, so the site changes its axis on the first click.**
Where: `src/app/page.tsx:55` (`max-w-5xl` wrapper) with every section `max-w-2xl` (`:77, :145, :192, :215, :253`), no `mx-auto` on the sections; `src/app/pricing/page.tsx:80` and all others use `mx-auto max-w-2xl`.
What: on home the h1 starts at x = 152 px; on `/pricing`, `/start/business` and every other page it starts at x = 328 px (`shots/home-fold-1280-light.png` versus `shots/pricing-1280-light.png`). This is exactly the "narrow left column, right half empty" the owner reported: a 672 px column against a 1024 px header, with 352 px of nothing on the right.
Why: the first impression is of an unfinished page; the jump of 176 px on navigation reads as a layout bug.
Fix: either centre the home sections (`mx-auto` on each `max-w-2xl` section) as the quickest fix, or, better, let home use the full shell width with a two-column hero (headline and CTAs left, 7/12; the "What a result looks like" card right, 5/12) and the four trust cards in a 2 × 2 grid (`grid sm:grid-cols-2 gap-4`).

**3. major: The questionnaire gives a laptop nothing to put beside the form.**
Where: `src/app/start/_components/step-shell.tsx:45` to `:93`; help text inside each field (`fields.tsx:49`, `:267`, `:333`); the "Not sure?" hint `supports-step.tsx:291`; the glossary disclosure `supports-step.tsx:274`.
What: at 1280 px the stepper, the heading, the glossary disclosure, the hint, the search box, the group list, the free-text box and the buttons stack in one 624 px column. The draft-status line sits at the very bottom in 12 px.
Why: the questions carry a lot of helper prose ("Roles with more than incidental contact with participants, key personnel, and roles the Commission's rules list…", 4 lines at 624 px); on a laptop it should sit beside the control, not between the label and the control, so a reader who knows the answer is not slowed down.
Fix: section 3 (questionnaire): form column 7/12, right aside 4/12 sticky (`lg:sticky lg:top-24`) holding, in order, the "Not sure?" hint, the glossary terms for the step, and the "ticked so far" list on the supports step. Keep the phone order as is.

**4. major: Documents, registers and the audit pack, the laptop deliverables, have no desktop layout and no primary download action.**
Where: `src/app/documents/page.tsx:221` to `:243` (three identical secondary buttons, `const button` at `:35`); `src/app/documents/[setId]/page.tsx:126` to `:142` (same two buttons); `src/app/registers/page.tsx:195` to `:203` ("Download my audit pack" is a 14 px underlined text link inside a paragraph).
What: on the paid documents page the three actions "Download all (zip)", "Readiness summary (PDF)" and "Open the document set" are equal bordered buttons whose labels wrap to two lines inside the 624 px card (`product/evidence/req-007/documents-ready-desktop-chromium.jpg`). On the registers index the audit pack zip, the main reason to open that page before an audit, is a text link under the intro, visually lighter than every register row below it.
Why: a provider on the night before the audit is looking for one obvious button; the page gives three equal ones, or none.
Fix: documents page: `Download all (zip)` as `btn-primary` with a file-size and count hint beneath ("22 Word files and the readiness summary, about 1.4 MB"), the PDF and "Open the set" as `btn-secondary`; on a laptop put the pack card in the left 7/12 and a right 5/12 "What is in it" list of the 22 titles, each a link to its document. Registers index: a `btn-primary` "Download my audit pack (zip)" in the page header row, right-aligned from `lg`, with the date of the last export beneath.

**5. major: Registers are lists, not tables; on a laptop the owner cannot scan by date, status or due date.**
Where: `src/app/registers/_components/register-list.tsx:98` to `:120` (one `<li>` per entry: title line, a grey summary line, a status pill and a chevron); `src/app/registers/page.tsx:234` to `:260` (the index: 14 registers as a single list).
What: the list is the same at 360 and 1280 px (`product/evidence/req-009/registers-lapsed-desktop-chromium.jpg`): "INC-0001: Restrictive practice used … › Closed" with "2026-10-09, P-014. Door locked…" beneath. There is no column for date, due date or reporter; with 30 incidents you read every line to find the open ones. The filter chips do the work a sortable column header would.
Why: the registers are what an auditor samples; the owner prepares by scanning for "open", "overdue", "due this month". A table is the right shape on a laptop and already exists in the codebase (`src/components/data-table.tsx`, which stacks to cards under 640 px).
Fix: from `sm`, render the register list through `DataTable` (or a sibling `RegisterTable`) with columns per register (incidents: Ref, Date, What happened, Status, Notify by; worker checks: Worker code, Check, Expires, Status), status as the existing tag, the row title linked; keep the card list under 640 px. On the index, a 2-column grid of register cards from `lg` (`grid lg:grid-cols-2 gap-x-8`) with the count and the attention line, so 14 registers fit one screen.

**6. major: The result page's long content (reasons, 24 standards, 22 documents, 5 registers) is a single column at 1280 px with triple-nested bordered boxes.**
Where: `src/app/start/_components/steps/result-step.tsx:347` (card), the three `<details>` sections, document groups nested as `<details>` inside `<details>` inside a bordered `<section>`.
What: `shots/crop-result-open-b-1280-light.png` shows a bordered disclosure, inside it a bordered group disclosure, inside it a divided list: three nested borders, each with its own padding, so a document title sits 64 px in from the card edge, and the whole thing is 5,075 px tall at 1280 px.
Why: the result is the page a provider forwards to a partner or prints; on a laptop it should read as a report, with the summary card and the three sections visible together.
Fix: section 3 (result): at `lg`, summary card plus ready line in a sticky left 5/12 column; the three sections in the right 7/12 column as plain `<section>`s with `<h2>`s, open by default on `lg` (keep `<details>` closed under `lg`); drop the inner borders and use a 1 px divider list only (`divide-y`).

**7. minor: `/sample` and the document reader use a third width (`max-w-3xl`); sign-in a fourth (`max-w-md`).**
Where: `src/app/sample/page.tsx`, `src/app/documents/[setId]/[typeId]/page.tsx:62` (`max-w-3xl`), `src/app/sign-in/*` (`max-w-md`).
What: four content widths (448, 672, 768, 1024) with no rule. `shots/sample-1280-dark.png` versus `shots/pricing-1280-light.png`.
Fix: two reading widths only: `--measure-prose` 68ch (about 720 px) for documents and guides, and the grid for everything else.

**8. polish: Nothing above 1024 px changes; 1536 px is the same page as 1280 px with wider margins.**
Where: `metrics.json` (`home-1280-light` and `home-1536-light` both report h1 width 672 and identical heights).
Fix: the grid in section 3 scales to `max-w-6xl` (1152 px); above that, margins grow, which is right.

### B. The questionnaire: stepper, controls, feedback

**9. bug: Inline errors and the error summary stay on screen after the field is corrected.**
Where: `src/app/start/_components/steps/business-step.tsx:79` to `:97` (`errors` state set on submit only, cleared only on a successful submit); same pattern in the other steps.
What: after an empty submit, typing "Sunrise Supports" leaves "Enter your trading name" in red under the filled field and all three items in the summary box (`shots/crop-q1-768-dark.png`, `shots/q1-business-filled-1280-light.png`).
Why: a first-time user reads the red line as "still wrong" and does not know what else to do; GOV.UK's pattern clears a field's error once it validates on blur or change.
Fix: on change of a field that has an error, re-run that field's schema and clear its entry in `errors` (and drop it from the summary); keep the summary for the next submit.

**10. major: Radios and checkboxes are the browser's default blue; the brand's accent is ochre.**
Where: no `accent-color` anywhere (`grep accent-color src` returns nothing); `fields.tsx:207`, `:355` render native inputs.
What: every selected control on every step, the checklist and the register forms is Chrome's #0075FF blue (`shots/crop-q4-1280.png`, `product/evidence/req-009/incident-form-desktop-chromium.jpg`, the "Reportable to the Commission" checkbox). In dark mode the unselected radios are mid-grey discs with no ring (`shots/crop-q3-1280-dark.png`).
Why: the one colour the brand reserves "for the thing that matters" is absent from the thing the user is choosing; the blue is the only cool, saturated colour on the page and it is not ours.
Fix: `input[type="radio"], input[type="checkbox"] { accent-color: var(--ochre); }` in `globals.css` under the `body` rule; 20 × 20 px is already set. Dark ochre #E0734A with a dark-paper check mark passes (5.55:1).

**11. major: Text inputs have no visible boundary in dark mode and a weak one in light.**
Where: `src/app/start/_components/fields.tsx:22` (`border-zinc-300 bg-white … dark:border-zinc-700 dark:bg-zinc-950`).
What: dark: the input background is zinc-950 = dark paper (#141C1B), the same as the page, and the border zinc-700 (#3A4442) measures **1.72:1** against it (`shots/q1-business-errors-360-dark.png`: the trading-name and ABN fields are nearly invisible rectangles). Light: pure white (#FFFFFF, off-token) on paper is 1.11:1 and the zinc-300 border on paper is **1.80:1**. WCAG 1.4.11 asks 3:1 for the boundary of a control.
Fix: light: `bg-paper border-slate` (slate on paper 6.99:1) or a 2 px `border-zinc-400` (#8E9593 on paper 2.76:1, still short; prefer `--slate`). Dark: `dark:bg-[#1A2422] dark:border-[#5E6866]` or better, add a dark `--line` token (#4A5553 on #141C1B = 2.24:1 is still short; use #6B7673 ≈ 3.3:1). See section 4 for the token.

**12. major: The input focus ring is ink, not ochre, so the questionnaire breaks the one focus rule the brand has.**
Where: `fields.tsx:22` (`focus:border-zinc-900 focus:outline-2 focus:outline-offset-1 focus:outline-zinc-900 … dark:focus:outline-zinc-100`); `brand.md` "Focus ring: 2 px ochre with a 2 px offset on every focusable element"; `globals.css:114`.
What: text fields and the search box show a black (light) or near-white (dark) ring, every other control shows ochre.
Fix: delete the four `focus:*` colour classes and let the global `:focus-visible` rule apply; keep `focus:border-slate` if a border change is wanted.

**13. major: Choice rows have no hover feedback in light mode.**
Where: `fields.tsx:196` and `:345` (`hover:bg-zinc-50`), `src/app/documents/page.tsx:35` (`hover:bg-zinc-50` on buttons).
What: zinc-50 is remapped to paper (#F7F3EC, `globals.css:69`), the page background, so hovering a radio card changes nothing (confirmed on `q4-workforce-1280-light`: the hovered "Yes" row is identical to the others except for the checked border).
Fix: `hover:bg-mist` (1.19:1 against paper is a visible shift) and `dark:hover:bg-[#223030]`.

**14. major: The checked state of a choice row is a 1 px ink border only; at a glance a checked row and an unchecked row look alike until you find the radio.**
Where: `fields.tsx:196` (`has-[:checked]:border-zinc-900`, no fill).
Fix: `has-[:checked]:bg-sky has-[:checked]:border-ink` (ink on sky 11.7:1; dark sky #1E3330 with dark ink 11.5:1), which also gives the ochre accent a calm field to sit on.

**15. minor: The desktop stepper's labels are 12 px and its done circles use white on ochre, which in dark mode is 3.12:1.**
Where: `src/app/start/_components/stepper.tsx:140` (`text-xs` labels), `:137` (`bg-ochre … text-white` on done), `:145` (current circle `bg-white`, off-token in light).
What: `shots/crop-q3-1280-dark.png`: ✓ in white on #E0734A. The current circle is pure white on paper, the only pure white on the page.
Fix: labels `text-sm`; done circle `text-paper` (light: paper on ochre 4.95:1; dark: dark paper on dark ochre 5.55:1); current circle `bg-paper ring-2 ring-ochre`.

**16. minor: The "Show steps" disclosure list on the phone is a white dropdown in a warm UI.**
Where: `stepper.tsx:76` (`bg-white … dark:bg-zinc-900`).
Fix: `bg-paper border-slate shadow-md`.

**17. minor: The phone stepper takes 150 px of a 740 px screen on the result page, where a reader has finished and the steps are least useful.**
Where: `step-shell.tsx:47` renders `Stepper` on every step including `result`; REQ-015 FR-4 measures the fold from the card.
What: on `shots/crop-result-fold-360-light.png` the card's button ends at y ≈ 698 of 740; the stepper and "Start again" above it cost 190 px.
Fix: on `result`, collapse the stepper to the one-line "Step 6 of 6: Result · Change my answers" (the link opens the existing step list) and move "Start again" into the card footer.

**18. minor: The glossary disclosure "What these words mean (N)" sits between the page title and the first question on every step and reports different counts at different widths.**
Where: `src/components/glossary-terms.tsx:27`; `supports-step.tsx:274`; D-2701 puts it "above the page's first body section".
What: desktop shows "(2)" and phone "(1)" on the supports step (`shots/crop-q2-top-1280-light.png` versus `crop-q2-top-360-light.png`), because the count follows which headings are open (D-2721). On every page it is the first interactive element after the h1, before the thing the person came to do.
Why: a sole trader scanning for the first question meets a closed grey line that looks like a form control; the count changing by viewport looks like a bug to anyone who sees both.
Fix: keep the rule (one disclosure per page) but move it to the aside on `lg` and to the end of the page's first section on phones (after the first question block, before the list), styled as a note (`text-slate`, no border, a small book icon), and count terms present in the data for the step, not in the open DOM, so the number is stable.

**19. minor: The supports-step group headings put a 14 px description in the serif.**
Where: `supports-step.tsx:349` to `:372`: the `<h2>` wraps the whole button including the description `<span className="block text-sm font-normal …">`, so the global `h1,h2,h3 { font-family: serif }` (`globals.css:97`) cascades to it.
What: "Help with showering, dressing, eating, medication and health needs." renders in Fraunces at 14 px, the only serif body text on the site (`shots/crop-q2-top-1280-light.png`).
Fix: put only the title span inside the `<h2>` (or add `font-sans` to the description span); the serif is for headings only.

**20. minor: The free-text "Anything else about your services" on the supports step collects text that is never used on the result and sits at the bottom of a 6,000 px page.**
Where: `supports-step.tsx:421` to `:470`.
Fix: if it feeds generation, say so in the help text ("We use this when drafting your documents"); if not, remove it from the free flow. On a laptop it belongs in the aside under the ticked list.

**21. polish: The "Save and continue" button is right-aligned on desktop and full-width on phones, but "Back" is a secondary at the far left; the two are 500 px apart at 1280 px.**
Where: `fields.tsx:427` (`sm:justify-between`).
Fix: group both at the right (`sm:justify-end gap-3`), Back first; the eye finds the primary where the text ends.

**22. polish: The draft-status line is 12 px.**
Where: `step-shell.tsx:77` (`text-xs`); `brand.md` "never below 16 px on phones".
Fix: `text-sm` (14 px) at minimum, and move it next to the stepper line on `lg` ("Saved on this device · Step 2 of 6").

### C. Home page

**23. major: The hero's second paragraph restates the headline; the two price lines are 14 px body text under the buttons, below the "free" line.**
Where: `src/app/page.tsx:81` (h1), `:84` (lead), `:107` to `:136` (the two `text-sm` price lines); copy in `src/lib/home-copy.ts`.
What: the h1 already says free + every document + AUD 399; the lead repeats "tells you which audit you face … then drafts every document"; then "Free, about ten minutes" (14 px grey); then "What keeps you audit-ready: AUD 39 a month…" and "Where you start: AUD 399 one-off…" as two 14 px paragraphs with bold run-in labels (`shots/home-fold-1280-light.png`). The subscription line comes first although the CTA and headline sell the pack; the two strongest numbers on the page are in the smallest type.
Why: a sole trader decides on price; burying it in 14 px grey under a button, in an order that leads with the monthly product, reads as hedging.
Fix: hero = eyebrow, h1, one lead sentence that is not in the h1 ("Ten minutes of plain questions. No account to start."), the two buttons, then a two-cell price strip at 16 px with tabular figures: "Document pack · AUD 399 once" | "Registers · AUD 39 a month, cancel any time", each cell a link to its pricing card. Move the refund sentence into the pack cell as a second line. On `lg`, place the example result card (`:214` to `:248`) to the right of the hero so the first screen shows the product.

**24. major: Four "What you can count on" trust cards are stacked full-width in a column; on a laptop they are four 624 px wide boxes of two lines each.**
Where: `page.tsx:191` to `:212`.
Fix: `grid sm:grid-cols-2 gap-4` from 640 px; each card: bold title line, text, no border (use `bg-mist/60 rounded-md p-4`).

**25. minor: The h2s on home are 20 px (`text-xl`) in the serif under a 36 px h1: a 1.8 jump then nothing between.**
Where: `page.tsx:149, :196, :219, :257` (`text-xl font-semibold`).
Fix: section h2 `text-2xl sm:text-3xl` (24/30 px) at weight 500; see the type scale in section 4.

**26. minor: The example result card's "0 of 20 documents and registers in place" line is almost invisible because the track is mist on a mist-coloured card.**
Where: `page.tsx:225` (`bg-zinc-50`, which is paper) and `src/components/ready-line.tsx:49` (`fill-mist`): mist on paper **1.19:1**.
Fix: finding 34 (token for the track).

**27. polish: "What you get" is a plain bullet list after the mission; it repeats "Which Practice Standards modules apply… verification or certification audit", already said in the hero.**
Where: `page.tsx` "What you get" section, `home-copy.ts`.
Fix: fold into the sample card as four short rows with ink line icons, or cut.

### D. Dark mode

**28. major: Dark mode is a near-black page with borders you cannot see: zinc-800 on dark paper is 1.38:1, zinc-700 is 1.72:1, dark mist on dark paper 1.17:1.**
Where: `globals.css:25` (`--paper: #141c1b`), `:26` (`--mist: #1f2a28`); 58 uses of `dark:border-zinc-800` and 144 of `dark:border-zinc-700` (`site-header.tsx:98`, `site-footer.tsx:182`, `page.tsx:203` trust cards, `fields.tsx:196` choice rows, `result-step.tsx:348`, the data table rows).
What: `shots/home-fold-1280-dark.png`: the header rule, the trust cards and the sample card edges are guesses; `shots/q1-business-errors-360-dark.png`: the radio cards are faint outlines on black. The owner's screenshot described "very dark near-black UI with low-contrast borders and dim helper text" is this.
Why: the brand promise is "ink, not black; paper, not white"; the dark theme delivers black and loses the warmth and the structure.
Fix (section 4): lift dark paper to **#1B2422** and dark mist to **#27322F**, add a `--line` token (light #CFC7B9 ≈ 1.5:1 for decorative rules, **#8E9593** 2.9:1 for control borders on light; dark **#5F6B68** ≈ 3.1:1 on #1B2422), and replace `dark:border-zinc-800`/`-700` with `border-line` by a single search-and-replace. Raise the dark card surface one step (`#222D2A`) so cards read as cards.

**29. major: `text-zinc-500` without a dark variant is 3.01:1 on dark paper (fails AA), in seven places.**
Where: `supports-step.tsx:360` (the ▸ marker), `:397` ("No class matches…", the empty-search status), `src/app/registers/page.tsx:255` (the › chevron), `src/app/registers/_components/register-list.tsx:116`, `src/app/checklist/checklist-view.tsx:444`, `src/app/guides/[slug]/cost-calculator.tsx:80` (class codes), `src/app/documents/[setId]/page.tsx:165` (document numbers).
What: #5E6866 on #141C1B = **3.01:1**; axe did not see it because the states were not rendered in the CI runs (empty search) or the pages are signed-in.
Fix: `text-zinc-500 dark:text-zinc-400` (dark 5.67:1), or `text-slate` (6.99 / 9.34).

**30. minor: Dark helper text is dimmer than it needs to be inside cards: zinc-400 on the zinc-900 card is 4.81:1; on sky it is 4.37:1 (fails).**
Where: every `dark:text-zinc-400` inside `dark:bg-zinc-900` (`result-step.tsx:348` card with `:357`; `supports-step.tsx:291` hint box; `page.tsx:225` example card) and inside `bg-sky` notices.
Fix: `--slate` dark is #B8C0BD (7.92:1 on the card); use `text-slate` for helper text everywhere and retire `dark:text-zinc-400`.

**31. minor: The error summary in dark is Tailwind's default `red-950` (#450A0A), a cool saturated red box that is not in the palette.**
Where: `fields.tsx:395` (`dark:bg-red-950`), light `bg-red-50` (#FEF2F2, 1.01:1 against paper, so the box is border-only in light).
What: `shots/q1-business-errors-360-dark.png`: the only saturated surface in the dark UI is an error.
Fix: light `bg-[color-mix(in_srgb,var(--signal)_8%,var(--paper))]` or a `--signal-wash` token (#F3E4E2); dark `#33201F`; keep the signal border.

**32. minor: The dark footer is indistinguishable from the page (`dark:bg-zinc-950` = dark paper), and so is the light footer (`bg-zinc-50` = paper).**
Where: `site-footer.tsx:182`.
Fix: `bg-mist/50 dark:bg-[#19221F]` plus the `--line` top rule.

**33. polish: `dark:` utilities and `data-theme` disagree.**
Where: `globals.css:36` defines `:root[data-theme="dark"]` tokens, but Tailwind v4's `dark:` variant is `prefers-color-scheme` only; no `@custom-variant dark` is declared, and nothing sets `data-theme`.
What: if a theme toggle is ever added using `data-theme`, the 376 `dark:` utilities will not follow it.
Fix: `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *), @media (prefers-color-scheme: dark) { &:where(:not([data-theme="light"]), :not([data-theme="light"]) *) })`, or drop the attribute blocks.

### E. The line motif, contrast and colour

**34. major: The ready line, the identity's motif, is invisible when nothing is done: the empty track is mist on a paper-coloured card (1.19:1 light; 1.006:1 dark on the zinc-900 card).**
Where: `src/components/ready-line.tsx:49` (`fill-mist`), used on the result card (`result-step.tsx:394`, card `bg-zinc-50 … dark:bg-zinc-900`) and home (`page.tsx:230`).
What: on `shots/q6-result-closed-1280-light.png` the line is a faint grey rule between two paragraphs; on `q6-result-closed-1280-dark.png` it is not there at all. For a first-time result, done is always 0, so every first viewer sees no line.
Why: REQ-014 built the identity on this line; on the page that matters most it reads as a divider.
Fix: a `--track` token (light **#CFC7B9**, 1.5:1 on paper and 1.3:1 on mist, visible at 6 px; dark **#3A4442**) and height 8 px; draw the "to prepare" segment in ochre as REQ-014 asked (moss done, ochre to prepare, track remainder), so a 0-of-22 result still shows a full ochre line labelled "22 to prepare".

**35. major: Decorative and structural borders fail or nearly fail non-text contrast in light mode too: zinc-200 on paper is 1.40:1, zinc-300 1.80:1.**
Where: `border-zinc-200` (57 uses: choice rows `fields.tsx:196`, trust cards `page.tsx:203`, dividers) and `border-zinc-300` (145 uses: cards, inputs, tags, buttons `documents/page.tsx:35`).
What: for cards and dividers 1.4:1 is acceptable; for the boundary of a control (radio cards, the search box, secondary buttons on the documents page) 1.4 to 1.8:1 fails WCAG 1.4.11 (3:1).
Fix: two tokens: `--rule` for decoration (keep ≈ 1.5:1) and `--line` for control boundaries (≥ 3:1; light #8E9593 is 2.76, so use **#7E8785** = 3.2:1 on paper); apply `--line` to inputs, choice rows, secondary buttons and the filter chips.

**36. minor: Ochre text on mist is used by the stepper link row after all ("You need one" tags inside the result card, which is paper-coloured, pass at 4.95:1; but the same tag inside a `bg-mist` surface would be 4.17:1).**
Where: `brand.md` rule "ochre text sits on paper only"; tags `result-step.tsx` "You need one" (ochre border and text) render inside the result card which is `bg-zinc-50` = paper (OK) and in the checklist row (paper, OK). The hint box on the supports step is `bg-zinc-50` = paper, not mist, so its button is fine.
What: no current failure found, but the rule is one surface change away from one. Note for the token section: ochre text only on paper; on mist use ink.

**37. minor: The white ✓ on the dark done circle (3.12:1) and the `bg-white` current circle: see 15.**

**38. polish: `text-xs` (12 px) is used 26 times, including the footer brand line, class codes, audit tags, the "Draft saved" line, table column labels on phones and the status pills on the checklist.**
Where: `site-footer.tsx:213`, `supports-step.tsx:78, :227`, `step-shell.tsx:77`, `data-table.tsx:59`, `checklist-view.tsx` pills, `register-list.tsx:34`.
Fix: minimum 14 px (`text-sm`) for anything a person reads; 12 px only for the uppercase table labels with `tracking-wide`.

### F. Typography, hierarchy and spacing

**39. major: The type scale has two sizes for headings (30/36 px h1, 20 px h2) and the serif is set at `opsz 48` even at 20 px, so small serif headings look spindly next to Geist body text.**
Where: `globals.css:97` to `:104` (`font-variation-settings: "opsz" 48` for all h1–h3); h2s at `text-xl` across pages; group h3s at 16 px (`result-step.tsx` "Practice Standards modules that apply", `documents/[setId]/page.tsx:151`).
What: `shots/crop-result-open-a-1280-light.png`: "Practice Standards modules that apply (1)" in 16 px Fraunces at opsz 48 is thin and low-contrast at that size; the Fraunces optical axis exists to fix exactly this.
Fix: let the axis follow size: `font-variation-settings: "opsz" 48` only on h1; `"opsz" 24` on h2; `"opsz" 14` (or `font-optical-sizing: auto` and drop the override) on h3. Scale (REQ-014 asked for 1.25): h1 36 / 44 px (phone / `lg`), h2 26 / 30 px, h3 20 / 22 px, body 16 / 17 px with `leading-7`, small 14 px, label 12 px uppercase only.

**40. minor: Line length is 85 to 95 characters at 624 px for 16 px Geist; the legal pages and guides run close to 95.**
Where: all `max-w-2xl` prose (`src/components/legal-article.tsx`, guides).
Fix: `max-w-prose` (65ch) for article bodies; 17 px body on `lg`.

**41. minor: Spacing rhythm is ad hoc: section gaps are `mt-12` on home, `mt-10` on pricing and documents, `mt-8` on registers; cards use `p-3`, `p-4` and `p-5` on the same page.**
Where: `page.tsx:143, :191`, `pricing/page.tsx:66` (`mt-10`), `registers/page.tsx:224` (`mt-8`); `supports-step.tsx:291` (`p-3`) beside `:421` (`p-4`); `pricing/page.tsx:69` (`p-5`).
Fix: a 4-step rhythm: inside a card 16 px (`p-4`), between items 12 px (`gap-3`), between blocks 32 px (`mt-8`), between sections 48 px (`mt-12`), top of page 48/64 px.

**42. minor: Tags and pills use three styles.**
Where: audit tag `supports-step.tsx:78` (round, zinc-300 border, 12 px); group chip on the result `result-step.tsx:364` (round, zinc-300, 12 px with mono code); "You need one" (ochre, with a ○ icon); checklist "Need/Doing/Done" (ochre/moss, 12 px); register status tags (`register-list.tsx:34`, per-status classes).
Fix: one `Tag` component: 13 px, `px-2 py-0.5`, `rounded-full`, variants `neutral` (ink on mist), `need` (ochre on paper, ○), `doing` (ink on sky, ◐), `done` (moss on paper, ✓), `error` (signal on paper, !); always text plus icon.

**43. polish: Three disclosure styles on one page.**
Where: result page: the glossary `<details>` (no border, 14 px summary), the three sections (bordered, 18 px bold summary), the nested groups (bordered, 16 px); guides FAQ `guides/[slug]/page.tsx:193` (bordered, 16 px).
Fix: one `Disclosure` style (chevron right that rotates, 16 px semibold summary, `--rule` top border, no box), plus a "quiet" variant for the glossary.

### G. Buttons, links, focus and hover

**44. major: Links in the header, the guides index and the register lists are not visibly links until hovered.**
Where: `site-header.tsx:88` (`hover:underline` only), `guides/page.tsx:55` (title `hover:underline`), `registers/page.tsx:241`, `register-list.tsx:105`, `documents/page.tsx:361`.
What: `shots/crop-guides-top-1280-light.png`: four guide titles in ink with no underline, no colour and no chevron; nothing says they open. WCAG 1.4.1 is about colour-only links; here there is no cue at all.
Fix: lists of links: title in ink with a right chevron in slate and `hover:bg-mist` on the whole row (the register index already has the chevron; the guides index needs it); header nav: 16 px, `text-ink`, 2 px ochre underline on the current section; inline links keep the underline.

**45. minor: Secondary buttons and chips have at least three recipes.**
Where: `.btn-secondary` (`globals.css:229`, slate border, 48 px); `documents/page.tsx:35` (zinc-300 border, 48 px, `hover:bg-zinc-50` which is paper); `supports-step.tsx:298` (zinc-400 border, 44 px, `hover:bg-white`); `register-list.tsx:74` chips (zinc border, 44 px).
Fix: everything uses `.btn-secondary`; add `.btn-secondary-sm` (40 px) for in-card actions; hover `bg-mist` everywhere.

**46. minor: The primary button's hover is `filter: brightness(0.92)`, which is barely perceptible on ochre, and its disabled state is `opacity: 0.6` ochre, which keeps the accent on a dead control.**
Where: `globals.css:223`, `:226`.
Fix: hover `background: color-mix(in srgb, var(--ochre) 88%, var(--ink))`; disabled `background: var(--mist); color: var(--slate); border: 1px solid var(--line)`.

**47. minor: The skip link is unstyled apart from position: paper background on paper with a 2 px ring.**
Where: `src/app/layout.tsx:64`.
What: `shots/home-skiplink-1280-dark.png`: it appears as "Skip to main content" in a thin ring with no fill contrast.
Fix: `focus:bg-ink focus:text-paper focus:shadow-md focus:rounded-md`.

**48. polish: `button:active` adds `transform: translateY(1px)` to every button including the stepper circles and summary toggles; on a laptop with a trackpad the shift reads as jitter.**
Where: `globals.css:150` to `:163`.
Fix: keep the background shift, drop the transform except on `.btn-primary`/`.btn-secondary`.

### H. The "Not sure?" hints, help text and micro-copy placement

**49. major: The "Not sure?" hint on the supports step is a grey box with a secondary button that looks like a notice, not an offer; on a laptop it sits between the question and the search box.**
Where: `supports-step.tsx:291` to `:302`.
What: `shots/crop-q2-top-1280-light.png`: a bordered box, 14 px text, "Choose those two for me" as a small outlined button; the eye reads it as a disclaimer.
Fix: style as an offer: `bg-sky` (info surface, never text-coloured), an ink title "Not sure which classes?", one sentence, and the button as `btn-secondary` with a tick icon; on `lg` move it to the aside, top; on phones keep it but after the search box so the search is first.

**50. minor: The restrictive-practices step leads with three bullet examples, then a bordered "What counts?" disclosure, then the question; the question is the fifth block on the page.**
Where: `src/app/start/_components/steps/practices-step.tsx:123` (examples list), `:128` (the bordered "What counts?" `<details>`), `:155` (the fieldset with the question).
What: `shots/crop-q3-1280-dark.png`: the question "Do you use, or plan to use, any of these…" is 530 px down at 1280 px and ~900 px down at 360 px (a full screen).
Fix: question first (legend as the h2), examples as the fieldset's help text in the aside on `lg` and under the legend on phones; "What counts?" as a quiet disclosure under the options.

**51. minor: Help text repeats the participant-data warning under every free-text field on register forms.**
Where: `product/evidence/req-009/incident-form-desktop-chromium.jpg`: "No participant names, dates of birth, NDIS numbers, addresses or health details. Use codes like P-014." under both textareas; REQ-015 FR-11 already moved this to "once at the top" for the checklist.
Fix: one notice at the top of each register form; `placeholder="Use a code like P-014, never a name"` on the fields.

**52. minor: The result card has three calls to action plus a "Next:" sentence; REQ-015 FR-4 and D-2707 asked for one button and one link.**
Where: `result-step.tsx:404` to `:434`: `btn-primary` "Start getting ready", link "Open your checklist (40 things)", link "See the price", then "Next: sign in, then 'About your business'."
What: `shots/crop-result-fold-360-light.png`: four next steps in 180 px. "Start getting ready" says nothing about what happens (it goes to sign-in); the "Next:" line explains the button, which means the button label is wrong.
Fix: one `btn-primary` "Sign in to get ready" (signed out) / "Open your guided path" (signed in); one text link "See the price (AUD 399)"; the checklist link moves to the "Documents you will need" section header as "Open these in your checklist".

**53. minor: The count lines in the card do arithmetic in prose: "Checklist: 40 items (27 above plus 13 about your workers, insurance and the audit)".**
Where: `result-step.tsx` `lines.checklist` (from `result-copy.ts`).
Fix: a three-cell stat row with tabular figures: **22** documents · **5** registers · **13** other checks; one sentence beneath: "Your checklist has all 40."

**54. minor: The result page repeats the general-information statement that the footer carries 200 px below it, word for word.**
Where: `result-step.tsx` (the paragraph after "What happens next") and `site-footer.tsx:207`.
Fix: keep one; on the result, one short line "General information, not legal advice. Sources are linked under each reason." linking to `/terms`.

**55. minor: The pricing page's h1 "Your document pack" sits over a layout whose first card is the subscription; the subscription card has no button, only a 14 px "Sign in to subscribe" sentence.**
Where: `src/lib/payments/copy.ts:24` (title), `pricing/page.tsx:127` to `:190`; "No instalments, no interest, no late fees." (`copy.ts:86`) appears in the same card as "Cancel at any time; no notice period, no fee, no instalments, no interest." (`:71`).
What: `shots/pricing-1280-light.png`: two cards of unequal height and weight; the one without a button is first.
Fix: h1 "Pricing"; both cards get the same skeleton (eyebrow, name, price in 30 px tabular, three bullets, one `btn-secondary` for the subscription "Sign in to subscribe" and `btn-primary` for the pack); one no-interest sentence under both cards; equal heights with `grid sm:grid-cols-2 items-stretch`.

**56. minor: The sample document shows the literal block "Generic text: add your details." to prospects.**
Where: `src/lib/generator/fallback-text.ts:13` (`GENERIC_MARKER = "Generic text: add your details."`), rendered by `src/components/sample-document.tsx` as a bordered callout in the "In plain words" section (`shots/sample-1280-dark.png`); the marker is deliberate for a paid pack (`src/server/generation/run.ts:199` explains it in the cover note) but the sample has no cover note.
What: a visitor evaluating the product reads "Generic text" in a bordered callout inside the one document meant to prove the drafts are not generic.
Fix: in the sample, replace the marker with the one-line explanation the cover note gives ("This section is complete but general; you make it yours") in slate, or pick a recorded sample whose sections all drafted; in paid documents keep the marker but as an inline note, not a bordered box.

**57. polish: "In development" badge (previews only) competes with the wordmark on phones, where it wraps to a third position.**
Where: `site-header.tsx:118` to `:125`.
Fix: on previews, a 1-line ochre banner above the header instead of a pill in the nav row.

### I. Empty, loading and error states

**58. major: Registers and documents have no empty-state design: "0 entries. Nothing open." is the whole page for a new subscriber.**
Where: `registers/page.tsx:248` to `:251` (count line only); `register-list.tsx:91` ("No … yet" paragraph).
What: `product/evidence/req-009/registers-index-desktop-chromium.jpg`: four rows of "0 entries" with chevrons; the first thing a paying subscriber sees is a list of nothing.
Fix: an empty state per register: one sentence of what the auditor will ask for ("An auditor asks for every incident since you registered; add the first on the day it happens"), the `btn-primary` "Add an incident", and the CSV import link where one exists (worker checks). On the index, the ready line across the top ("3 of 14 registers started") as REQ-014 planned.

**59. minor: The supports step's empty-search state is 14 px zinc-500 text with no action.**
Where: `supports-step.tsx:397`.
Fix: "No class matches 'xyz'. Try a plainer word (cleaning, driving, therapy), or clear the search." with a "Clear" button.

**60. minor: The documents page "preparing" state relies on the writing indicator; the "delayed" state (`documents/page.tsx:193`) is a bordered box with a `role="status"` sentence and no indication of what to do.**
Fix: add the expected time and a `btn-secondary` "Email me when it is ready" (or the contact link while that does not exist).

**61. polish: The 404 page is good (`shots/crop-404-1280-light.png`); it should also carry a search or the guides list on `lg` instead of 60 % empty height.**

### J. Phone-specific

**62. minor: On a phone the first tickable class on the supports step is 900 px down (`shots/crop-q2-top-360-light.png`): title, glossary, question, 5-line intro, hint box, search, "Nothing chosen yet", then the first group.**
Fix: order on phones: title, question (one line), search, hint (collapsed to one line "Not sure? Choose the two most common"), groups; the intro paragraph goes into the glossary/aside.

**63. minor: The eight state checkboxes are a 2-column grid of bordered cards on phones (`sm:grid-cols-4`), 8 cards × 56 px = 450 px for a question whose answer is usually one tick.**
Where: `fields.tsx:338`.
Fix: compact chips (`inline-flex`, 44 px tall, `gap-2 flex-wrap`) for short enumerations; cards only when there is help text.

**64. polish: On phones the pricing strip (`pricing/page.tsx:92`) is a bordered box with two underlined links; it reads as a notice. Make it the two-cell price strip from finding 23.**

### K. Consistency and misc

**65. minor: The stepper's primary indicator is 14 px slate text "Step 2 of 6: Supports" above the circles, and the h1 comes after both; three competing titles at the top of every step.**
Fix: on `lg`, one row: h1 left, "Step 2 of 6" right in slate; circles beneath the h1 as a thin bar. On phones keep the current order but drop the step name from the line (the h1 says it).

**66. minor: `.btn-primary` colour is `var(--paper)` on ochre: 4.95:1 in light; white would be 5.47:1. Fine, but the stepper uses `text-white` and the input `bg-white`: three whites. Pick paper everywhere.**

**67. polish: Footer links are 14 px in slate with `hover:underline` only; the brand line is 12 px.**
Where: `site-footer.tsx:183`, `:213`.
Fix: 14 px minimum with underline; brand line 14 px.

**68. polish: `color-scheme: light dark` on `html` plus `bg-white` inputs means native selects and date pickers (register forms) render in the OS scheme while the page is forced by media query; a user who sets the site to light later (finding 33) will get dark native controls.**
Fix: set `color-scheme` from the same token block that sets the theme.

---

## 3. Desktop layout proposal

### The system

- **Shell container**: `mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8` (1152 px content at ≥ 1216 px). Header, next-step strip, main and footer all use it, so the wordmark, the h1 and the footer links share a left edge, and "Sign in" sits above the content's right edge.
- **Grid**: `lg:grid lg:grid-cols-12 lg:gap-x-8` inside the shell. Column = 72 px, gutter 32 px at 1152 px.
- **Page types**:
  - *Reading* (home sections, guides, legal, sample, document reader): main `lg:col-span-8` with `max-w-prose` (65ch), aside `lg:col-span-4 lg:col-start-9`, sticky (`lg:sticky lg:top-24 self-start`) for a table of contents / summary.
  - *Form* (questionnaire, register forms, sign-in, account sections): form `lg:col-span-7`, help aside `lg:col-span-4 lg:col-start-9`, sticky.
  - *List/table* (registers, checklist, documents set, audit pack): full `lg:col-span-12`, with a page header row (`flex items-end justify-between`) holding the h1 and the primary action.
- **Breakpoints**: unchanged under `lg` (phone first, as now); `md` (768) gets 2-column grids for cards and chips only; `lg` (1024) gets the 12-column grid; nothing new above `xl`.
- **Vertical rhythm**: page top `py-8 lg:py-12`; sections `mt-12`; blocks `mt-8`; inside cards `p-4`, `gap-3`.

### Page by page

**Questionnaire (`/start/*`).** Header row: h1 (`lg:col-span-7`) with "Step 2 of 6" in slate right-aligned in the same row; the circle stepper under the h1 across 7 columns as a 4 px line with 6 dots and 14 px labels. Form in columns 1–7: question legend (h2 size), control, inline error. Aside in columns 9–12, sticky: (1) the "Not sure?" offer (supports) / the three plain examples (practices) / "You said you are a sole trader, so we filled in the usual answers" (workforce); (2) "What these words mean" for the step, open by default on `lg`; (3) on supports, "Ticked so far (2)" with remove buttons and the class count by audit type ("1 site-audit class: your audit is certification"), which turns the aside into live feedback; (4) draft status and the "Start again" link. Buttons: `Back` and `Save and continue` right-aligned under the form column. The supports groups: all open on `lg` (as now), each group's class rows in a 2-column grid (`lg:grid-cols-2 gap-2`) so 38 rows become 19 rows; the page drops from ~5,900 px to ~3,200 px.

**Result (`/start/result`).** Columns 1–5, sticky: the summary card (audit kind, one sentence, the stat row 22 · 5 · 13, the ready line with the ochre "to prepare" segment, the group chips, one primary button, one price link), then "Change my answers" and "Start again" as small links. Columns 6–12: three sections, open on `lg`: "Why this result" (reasons with sources, modules), "Documents you will need" (the four groups as plain h3s with `divide-y` rows: title left, tag right; no nested boxes), "Registers to keep". Below both columns: the two pricing cells and "What happens next". Phone order unchanged (D-2708, D-2701).

**Documents (`/documents`, `/documents/[setId]`).** Full width page header: h1 "Your documents" left; right: `btn-primary` "Download all (zip)" with "22 Word files + readiness summary, 1.4 MB" beneath, `btn-secondary` "Readiness summary (PDF)". Then columns 1–5: the status card (paid on, receipt, refund terms, the "Start here" sheet link in ochre-bordered note); columns 6–12: the document list grouped by the four headings, each row: number, title (link), status tag ("Drafted" / "3 details to fill in" / "Adopted"), ".docx" download icon-button at the right. The document reader: columns 1–8 prose at 65ch, columns 9–12 sticky: "Download .docx", "Regenerate", "Adopt this version", the section list as a TOC with "Drafted from the answers" marked in ochre.

**Registers (`/registers`, `/registers/<name>`).** Index: page header with h1 left and `btn-primary` "Download my audit pack (zip)" right, "Last downloaded 12 October" beneath; the ready line across 12 columns ("3 of 14 registers started"); then two groups ("Keep as things happen", "Keep current") each a `lg:grid-cols-2 gap-x-8` of register cards: name, count, attention line in signal when urgent, chevron. Register page: header with h1, intro, `btn-primary` "Add an incident" right, `btn-secondary` "Export CSV" beside it; filter chips in one row; then the table (columns per register, status tag, row link), 48 px rows, sticky `thead`; under 640 px the existing card list.

**Audit pack.** Keep it on the registers index as above, and give it a one-screen "What is in the pack" disclosure beside the button (the 14 registers, the document-control register, the summary, the adopted documents) so a laptop user knows what the zip contains before the download, which is also the CLAUDE.md 4.2 point of delivery.

**Checklist (`/checklist`).** Columns 1–4 sticky: the counts, the ready line, "Next three things to do", "Print this checklist". Columns 5–12: the groups as plain h2s with the row list; the row's open state as a panel beneath the row across the full list width.

**Home.** Hero across 12 columns: 1–7 headline, lead, buttons, price strip; 8–12 the example result card with the line. "See exactly what you get": 1–7 sample card, 8–12 the two bullets. Trust: 2 × 2 grid across 12. Mission: 1–8 prose. Footer: links left, statements right in two 14 px columns.

**Guides and legal.** Columns 1–8 prose at 65ch; columns 9–12 sticky: the "Jump to" list as a real `<nav>` with one link per line and the current section underlined in ochre, "Last reviewed", and the short answer on guides. Headings get `scroll-mt-24`.

**Account.** Columns 1–3 sticky in-page nav of the nine sections; 4–12 the sections.

**Pricing.** Two equal cards side by side across columns 2–11 on `lg` (same skeleton, finding 55), the rest of the page prose at 65ch in columns 3–10.

---

## 4. Colour and type system

### Tokens as found (`src/app/globals.css:10` to `:82`, `src/lib/theme/tokens.ts`)

| Token | Light | Dark | Measured | Verdict |
|---|---|---|---|---|
| paper | #F7F3EC | #141C1B | ink/paper 13.3 (L) 14.9 (D) | keep light; **change dark to #1B2422** (lifts the page off black, keeps 13.5:1 with dark ink) |
| mist | #E6E0D6 | #1F2A28 | on paper 1.19 (L) 1.17 (D) | keep light; **change dark to #27322F** |
| ink | #1C2B2A | #F1EDE6 | | keep |
| slate | #4A5553 | #B8C0BD | on paper 6.99 (L) 9.34 (D) | keep; make it the only helper-text colour |
| ochre | #B4461F | #E0734A | on paper 4.95 (L) 5.55 (D); paper on it 4.95 / 5.55; **white on dark ochre 3.12** | keep; never `text-white` on it |
| moss | #2F6B4F | #6FBF95 | 5.69 / 7.89 | keep |
| signal | #9A2B2B | #E07A7A | 6.89 / 5.97 | keep |
| sky | #DCE8E6 | #1E3330 | ink on sky 11.7 / 11.5; **zinc-400 on dark sky 4.37** | keep; use `text-slate` on it |
| zinc ramp | 50 #F7F3EC … 950 #141C1B | same values in both schemes | zinc-400 on paper **2.76**; zinc-500 on dark paper **3.01**; zinc-200 on paper 1.40; zinc-800 on dark paper 1.38 | retire from new code |

### Add

| Token | Light | Dark | Use | Ratio |
|---|---|---|---|---|
| `--surface` | #FFFDF9 | #222D2A | cards, inputs | 1.04 on paper (L), 1.3 on dark paper (D); the card reads by its border and a 1 px shadow |
| `--rule` | #D9D2C6 | #34403D | decorative dividers, card edges | 1.5 (L) / 1.6 (D): visible, quiet |
| `--line` | #7E8785 | #6B7673 | control borders (inputs, choice rows, secondary buttons, chips) | 3.2 (L on paper) / 3.1 (D on #1B2422): meets 1.4.11 |
| `--track` | #CFC7B9 | #3A4442 | the ready line's empty segment | 1.5 (L) / 1.9 (D) at 8 px |
| `--signal-wash` | #F3E4E2 | #33201F | error summary background | signal text on it 6.2 (L) / 5.1 (D) |
| `--ochre-wash` | #F6E6DC | #3A2A22 | the "Drafted from the answers" edge fill, the next-step strip | ink on it 11.2 / dark ink 10.8 |

### Rules

- Text: ink for body, slate for helper, ochre only for the single accent per screen and only on paper or surface, signal for errors, moss for done. No `text-zinc-*` in new code; a lint (`tests/copy-lint.test.ts` has the AST walker) can fail a `dark:text-zinc-400` without a light pair.
- Borders: `--rule` for anything decorative; `--line` for anything a person can operate.
- Surfaces: paper (page) → surface (card, input) → mist (hover, selected row background → sky for selected choice).
- Replace `bg-white` (8 uses) and `text-white` (stepper) with `bg-surface` / `text-paper`.
- Form controls: `accent-color: var(--ochre)`; focus ring is the global 2 px ochre everywhere (remove the per-input ink ring).

### Type

- Fraunces for h1–h3 only, weight 500, `font-optical-sizing: auto` (drop the fixed `opsz 48`), tracking −0.01em on h1 only.
- Scale (phone / lg): h1 32/44 px `leading-tight`; h2 24/28 px; h3 19/20 px; body 16/17 px `leading-7`; small 14 px `leading-6`; label 12 px uppercase `tracking-wide` only for table headers.
- Measure: 65ch for prose; forms 7 columns.
- Numbers: `tabular-nums` on prices, counts and stat rows (already on `strong`, `dd`, `.tabular`; add `.stat`).

---

## 5. Prioritised plan (top 10)

1. **Shared shell container and the 12-column grid** (M): `max-w-6xl` on header, main, footer; grid utilities; centre the home sections as the interim fix. Fixes 1, 2, 7, 8.
2. **Dark theme lift and the four new tokens** (`--surface`, `--rule`, `--line`, `--track`) with a search-and-replace of `dark:border-zinc-800/700`, `border-zinc-200/300` on controls, `bg-white`, `text-white` (M): fixes 11, 28, 29, 30, 31, 32, 34, 35.
3. **Form control basics** (S): `accent-color: ochre`, drop the ink focus classes on inputs, `hover:bg-mist`, checked rows `bg-sky`, error-clear-on-change. Fixes 9, 10, 12, 13, 14.
4. **Documents and registers primary actions** (S): `btn-primary` "Download all (zip)" and "Download my audit pack (zip)" in page headers with size/contents hints; empty states for registers. Fixes 4, 58.
5. **Register tables on `sm`+** (M): route the register lists through `DataTable` with per-register columns; 2-column register index. Fixes 5.
6. **Questionnaire two-column** (M): form 7 / aside 4 with the hint, glossary and "ticked so far"; 2-column class rows; question-first on practices; stepper row. Fixes 3, 18, 19, 20, 21, 49, 50, 62, 65.
7. **Result page two-column and de-nesting** (M): sticky summary, sections open on `lg`, one primary action, stat row, ready line with the ochre segment. Fixes 6, 17, 34, 52, 53, 54.
8. **Home hero and price strip, trust grid** (S): price cells at 16 px with tabular figures, example card beside the hero, 2 × 2 trust cards. Fixes 23, 24, 26, 27.
9. **Type scale and optical size** (S): `font-optical-sizing: auto`, the h1/h2/h3 sizes, 14 px minimum, 65ch prose. Fixes 25, 38, 39, 40, 67.
10. **One Tag, one Disclosure, one secondary button** (M): components replacing the three recipes each; link affordance on list rows and header nav. Fixes 42, 43, 44, 45, 46.

Then: pricing card parity (55), the sample's "Generic text" block (56), the error-summary wash (31), the skip link (47), the `dark:` custom variant (33), the repeated participant warning (51), and the checklist sticky summary.
