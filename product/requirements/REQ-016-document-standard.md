# REQ-016: Document standard: what an auditor expects to see, and how every generated document is checked against it
Status: ready (PO, 13 Oct 2026)   Phase: 6 (before the first trial provider)   Priority: must   Owner: Dev (checks), PO (standard and review)
Depends on: REQ-005 (generator), REQ-015 (plain language)

## Why
Haider asked three things after reading his own pack on his phone: the document list should be numbered; are the fonts and layout what NDIS auditors expect; and why do two AI documents appear in every pack. The answers need a written standard, not opinions, so this REQ sets the profile every generated document must meet and asks for an automated check so a document that drifts from it cannot ship.

## What the research says (PO, 13 Oct 2026)
- The Commission does not prescribe fonts, templates or document names. Auditors check that each policy exists, is current, is implemented, and connects to records (training, acknowledgements, incidents, corrective actions). Every policy, procedure and form is expected to carry a version, an approval date, a review date and the approver's name; providers are expected to keep a review schedule and a change log, and to tell workers when a document changes (industry audit-preparation guidance; sources in the research doc).
- The Practice Standards require information for participants to be given in the language, mode of communication and terms that the participant is most likely to understand (that phrase recurs across the rights and provision standards). So participant-facing documents (service agreement, complaints information, rights, feedback, money and property) need a plain-language version a participant can actually read, and an Easy Read version is good practice, not a rule.
- Accessible document guidance (Vision Australia; the Australian Government Style Manual): a clear sans-serif font such as Arial or Calibri, body text never under 12 pt (16 preferred for participant-facing print), left-aligned, at least 1.5 line spacing, paragraph spacing, consistent heading styles, visible page numbers in a consistent place, tables with visible borders and repeated header rows, no ALL CAPS, italics and underline sparingly, nothing that depends on colour alone.
- There is no Commission requirement for an AI policy. The only Commission statement on AI is a February 2026 position statement on the use of AI in developing behaviour support plans. Sector guidance (DSC, UTS HTI) treats AI as a privacy and governance matter: tell participants when AI is used, never put participant information into public tools, name an accountable person. That belongs inside the privacy and information management policy, not in two standalone documents a sole trader doing household tasks will never be asked for.

## The standard (every generated document; the house-style file stays the voice rule, this is the shape rule)
- S-1 **Names.** Document titles follow the Practice Standards headings as the Commission names them, so an auditor recognises them at a glance (the current catalogue already does; keep it that way and add a test that every title maps to a standard name or a Commission term).
- S-2 **Document control** on page one: title, provider trading name, version, approved by (name and role, a placeholder until the provider fills it), approval date, next review date, and the standard(s) it supports. A change log table at the end (version, date, what changed, by whom), seeded with version 1.
- S-3 **Type.** Arial or Calibri; body 12 pt minimum (today 11 pt: raise it); headings in Word heading styles so navigation and a table of contents work; numbered headings; left-aligned; line spacing 1.15 to 1.5 with paragraph spacing; no justified text; no ALL CAPS headings; tables with visible borders and header rows repeated across pages; page footer with title, version and Page X of Y on every page.
- S-4 **Participant-facing documents** (service agreement template, complaints information, participant rights, feedback, money and property): a plain-language summary section at the top written at Year 6 level or below, 16 pt when printed, and a clearly marked place for an Easy Read version. Everything else stays at the Year 8 house-style level.
- S-5 **Nothing that relies on colour alone.** Tailored sections are marked with text ("Drafted from your answers"), colour only as a second cue.
- S-6 **AI documents.** Retire the two standalone AI documents. Their content becomes a section "AI and digital tools" in the privacy and information management policy (who may use which tools, no participant information in public tools, tell participants, the accountable person). The pack count drops by two; the result page, checklist and pricing copy follow automatically from the catalogue.
- S-7 **The set view** lists documents as a numbered list in audit order (governance first, environment last), with the group headings from the result page, so the pack reads as one system.

## Functional requirements
- FR-1 A docx lint in the LibreOffice CI job and in `npm test` over the recorded fixture sets: opens every generated .docx and asserts S-2, S-3, S-5 and S-7's order; fails the build on a miss. Report the font sizes and heading styles found.
- FR-2 Catalogue change for S-6 with a migration note for existing sets (existing sets keep their documents; new sets get the merged policy).
- FR-3 S-4 for the five participant-facing documents, with the plain-language summary drafted by the generator from the same facts and linted at Year 6.
- FR-4 Numbered set view (S-7), on both viewports.

## Acceptance criteria
- AC-1 The PO opens three generated documents (one governance, one participant-facing, one environment) in Word on a laptop and on an iPhone and finds every S-2 and S-3 item present.
- AC-2 The lint fails on a seeded document with 11 pt body text and on one without a change log.
- AC-3 A new pack for the sole-trader fixture has 22 documents, no standalone AI document, and the privacy policy carries the AI section.

## Dev response
(Dev fills in.)

## Delivery evidence
(Dev fills in.)

## PO review
(PO fills in.)
## Defect found by Haider on 13 Oct 2026 (blocks the trial; do this first)
In his own pack, the "AI and digital data handling procedure" has every section stamped "Review and complete: this section could not be drafted automatically", and the placeholder under each heading is the generator's internal section instruction, verbatim ("Never restate statutory timeframes ... Never name or ask for a Practice Standard"). Two defects in one: (a) a whole document shipped with nothing drafted, and the set page counted it as done; (b) prompt text reached the customer. The set summary says 41 sections across 20 documents are marked for review, so the first is not a one-off.
- FR-0a **Prompt text never reaches a document.** The section instruction and the customer placeholder are two different strings; the placeholder is written for the provider in the ui-copy voice ("[Add two sentences: what this document is for and which standard it supports.]"). A lint over every rendered document fails on any instruction phrasing ("Never", "Do not", "the outline", "Practice Standard" as an instruction, "fixed facts") inside a placeholder.
- FR-0b **A section that fails is retried, then filled, never left blank.** On a model failure or a refusal the section is retried once with the same facts; if it fails again, the fixed-text library supplies a complete generic version of that section for that document type (every type in the catalogue gets a full fixed fallback; a template beats a blank), marked "Generic text: add your details". A document may ship with at most 2 such sections; above that the job marks the document as failed and the set page shows "We are still working on this one" and retries on the next kick, with the tick log recording the reason (error type, status, refusal flag; never the content).
- FR-0c **Count what we promise.** The set page's "sections marked for your review" must count only genuine provider inputs (names, dates, approvals), not generator failures; failures are a separate line visible to the admin only. AC: the recorded sole-trader fixture pack ships with zero undrafted sections and at most 10 percent of sections marked for provider input.
- FR-0d **Diagnose Haider's run.** Dev reads the fixture replay for the two AI document types and the generation tick log structure to say why every section failed for that type (likely the prompt's own "never name a Practice Standard" rule colliding with a section schema that requires one), and records the cause as a Dev decision.
