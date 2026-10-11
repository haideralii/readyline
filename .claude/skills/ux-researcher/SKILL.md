---
name: ux-researcher
description: UX research standards for learning from small NDIS providers without meetings or sales calls - research questions, lightweight methods (surveys, async interviews, usability tests, search and community listening, in-product signals), participant recruitment and consent, synthesis into findings and personas, and feeding results into REQs. Use this whenever someone wants to understand users, validate an assumption, test a flow or copy with real people, analyse feedback or support messages, plan a survey or interview, or asks "do providers actually want this", "why aren't they subscribing" or "what should we ask them".
---

# UX researcher

The business is sold and delivered online with no meetings, so research must be asynchronous, cheap and respectful of busy providers. The customer is a sole trader or a 1 to 10 person provider preparing for registration, often learning from Facebook groups and late-night searches. Research exists to replace guesses in `product/domain/ndis-registration-primer.md` and REQs with evidence.

## Ethics and privacy first

- Participants in research are providers and workers, never NDIS participants. Never collect or accept information about people with disability; if a respondent includes it, delete it and note the deletion.
- Consent in plain language for every method: what we ask, how long, what we do with answers, that they can stop, how to withdraw. Store responses de-identified (respondent code, role, state, size) and delete raw contact details within 90 days unless they opted in to follow-up.
- No incentives that could look like inducements to buy; a small gift card for a usability session is fine and disclosed.
- In Facebook groups: identify yourself and the product honestly, follow group rules, never fake accounts, reviews or testimonials (`CLAUDE.md` section 5). Ask admins before posting a survey.
- Keep a research log in `product/research/log.md`: date, method, who (codes), question, where the raw data lives.

## Start with the question

Write the decision the research informs and the assumption behind it:

```
Decision: whether the pricing page leads with the subscription or the pack
Assumption: sole traders will not pay monthly before their audit date is known
Risk if wrong: conversion to subscription stays near zero after launch
Question: when in their registration journey do providers see ongoing value, and what would they expect it to cost?
Success: we can state the journey stage and a price band with evidence from at least 8 providers across 3 states
```

If the decision does not change with any plausible answer, do not run the research.

## Methods that work without meetings

- **Search and community listening**: Google autocomplete and People Also Ask for registration questions; Facebook group threads (read, do not scrape; capture themes and verbatim phrases with permission for quotes); Reddit and provider forums. Output: a question bank with frequency and the exact words used (feeds SEO content and questionnaire copy).
- **Short surveys** (under 5 minutes, 8 to 12 questions): one open question first, closed questions with "other", no leading wording, mobile-friendly form. Recruit via group posts and a link on the site. Aim for 30 or more responses before drawing counts; use open answers at any size.
- **Async interviews**: a 6 to 8 question written interview by email or messenger with one follow-up round; or a 15-minute recorded voice message exchange if they prefer. Script the questions, probe with "tell me about the last time".
- **Unmoderated usability tests**: a prototype or the staging app plus 3 to 5 tasks, recorded with the participant's consent (screen recording tools or just written answers plus task completion). Five participants per round; two rounds beat one big one.
- **In-product signals** (with the privacy-preserving analytics allowed by `DECISIONS.md`): step drop-off in the questionnaire, time per step, checklist items most often left red, help-text expansions, searches with no result, cancellation reasons (one optional question).
- **Support and feedback mining**: tag every inbound message by topic and journey stage; monthly summary of the top ten.
- **Competitor walk-throughs**: sign up to competitors' free tiers, record the flow and copy; note what providers praise or complain about publicly.

## Recruiting

- Screener: role (sole trader, owner, manager, worker), registration status (unregistered, applying, registered, renewing), supports delivered (group codes or plain labels), state, number of workers, device used most. Exclude consultants and auditors from user research (they are a different study).
- Aim for spread across states and across the three statuses; over-recruit sole traders because they are the primary customer.
- Keep a willing-participant list (opted in) for future rounds.

## Running sessions and tests

- Task wording describes the goal, not the UI: "Find out whether you would need an auditor to visit your service" not "Click Start".
- Record: completion, path, time, errors, confusion moments, verbatim quotes, confidence rating after each task, and one question at the end: "What would you tell another provider about this?".
- Test copy as much as layout: have participants explain in their words what a screen means (the "teach-back").
- Mobile first: at least three of five participants on their own phone.

## Synthesis

1. Transcribe or collect notes within a day; tag observations (confusion, need, workaround, delight, trust, price, privacy).
2. Affinity-cluster the tags; count participants per theme (not mentions).
3. Write findings as evidence statements with strength: "4 of 5 sole traders did not know whether personal care needs certification; all four searched for it on Facebook first (strong)".
4. Distinguish observed behaviour from stated preference; weight behaviour higher.
5. Update personas and journey map in `product/research/` (two or three personas at most, each with goals, fears, context, device, decision triggers, and the quotes that justify them).
6. Turn findings into recommendations with options and a recommended one, mapped to REQs; add new questions to the backlog.

## Report template

```
# Research: <title> (<date>)
## Decision and question
## Method and participants (codes, roles, states, sizes, devices)
## Findings (ranked, with strength and quotes)
## What this changes (REQ, screen or copy, with options and recommendation)
## What we still do not know
## Appendix: script, screener, consent text, raw data location
```

## Metrics to watch after launch

Questionnaire start to completion rate, time to first checklist view, pack purchase rate, subscription conversion within 30 days (the primary signal per `CLAUDE.md` v2), register first-entry rate, reminder open rate, cancellation reasons, support tickets per 100 accounts, search queries that led to no article.

Related skills: `ui-ux-designer` to turn findings into designs, `product-manager` for prioritisation and pricing, `product-owner` for writing the resulting REQ changes.
