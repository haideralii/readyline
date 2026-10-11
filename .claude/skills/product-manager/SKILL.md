---
name: product-manager
description: Product management standards for this solo, online-only, shariah-compliant SaaS for small NDIS providers - positioning, pricing and packaging honesty, roadmap and prioritisation, success metrics (subscription conversion first), competitor and regulator tracking, SEO content strategy, launch planning and post-launch learning loops. Use this whenever a question is about what to build next, why, for whom, at what price, how to measure it, how to launch or market it, or whether a feature belongs in the product, even if phrased as "should we add", "is this worth it", "how do we get customers" or "what do competitors do".
---

# Product manager

One founder, 8 to 10 hours a week, no sales calls, no meetings. Every product decision must earn its place against that constraint and against the legal, ethical and shariah rules in `CLAUDE.md` sections 4 and 5. The PO session writes REQs; this skill is for the thinking that precedes a REQ and the measurement that follows a release.

## Strategy in one page (keep `product/strategy.md` current)

- **Customer**: sole traders and 1 to 10 worker providers facing registration or renewal; secondary: SIL and platform providers caught by mandatory registration from 1 July 2026.
- **Job**: "Get me audit-ready without a consultant, and keep me ready afterwards."
- **Wedge**: the cheapest credible path (tailored documents for $349 to $499) that leads into the durable product (audit-ready subscription $29 to $49 a month) per `CLAUDE.md` v2.
- **Moat**: the curated, versioned, sourced standards mapping kept current; Australian hosting with no participant data; honest brand in a market full of overclaims.
- **Not doing**: care-delivery documentation, consulting, acting as or brokering auditors, ad networks, BNPL, enterprise compliance teams.
- **Positioning sentence**: "{{BRAND}} helps sole-trader and small NDIS providers prepare documents aligned to the NDIS Practice Standards, see what is missing before the audit, and keep registers current afterwards. General information, prepared for your review."

## Prioritisation

Score candidate work on four questions, each 1 to 3, and sort:

1. Does it move the primary metric (subscription conversion) or a gate to it (questionnaire completion, pack purchase)?
2. Does it reduce audit-day risk for the provider (the thing they pay for)?
3. Can it ship in one to two sessions with tests?
4. Is it defensible (sourced from the Commission, honest, privacy-safe)?

Anything scoring 1 on question 4 is out regardless. Record the score in the backlog row's notes. Reject scope outside `CLAUDE.md` unless Haider approves and `DECISIONS.md` records it.

## Pricing and packaging rules

- Fixed, disclosed prices with defined scope; what is included and excluded is listed on the pricing page and in checkout. No hidden fees, no interest, no late fees, no BNPL, no "contact us" pricing.
- Non-payment pauses, never penalises. Cancellation is self-service and immediate for billing, with access until period end.
- The subscription is the main offer; the pack is the entry step. Measure pack-to-subscription conversion from day one and review pricing after 30 paying customers, not before.
- Discounts only as simple, time-bound, visible promotions; no fake "was" prices.
- Referral arrangements with auditors are prohibited from carrying referral fees (Commission expectations, D-109). A fee-free, disclosed list of approved auditors is the only acceptable form.

## Metrics (define before launch, instrument privately)

| Stage       | Metric                                                                  | Target to revisit     |
| ----------- | ----------------------------------------------------------------------- | --------------------- |
| Acquisition | Organic sessions on article pages; article-to-questionnaire click rate  | growth month on month |
| Activation  | Questionnaire completion rate; time to readiness checklist              | 60% completion        |
| Revenue     | Pack purchases; pack-to-subscription within 30 days                     | 25% conversion        |
| Retention   | Monthly subscription churn; register entries per active account         | under 5% churn        |
| Quality     | Support tickets per 100 accounts; refund rate; claims-checker incidents | refunds under 5%      |
| Trust       | Privacy complaints (zero); accessibility issues reported                | zero                  |

Analytics must be cookie-less and first-party (`DECISIONS.md`); no ad trackers.

## Market and regulator watch (monthly, 30 minutes)

- Commission: Practice Standards reform page, mandatory registration pages, new fact sheets, AI position statements. Any change opens a REQ to update `data/standards.json` and the content.
- Competitors in `CLAUDE.md` 3a (NDISCompliant, Cenaris, template shops, consultants): pricing, claims, new features. Note overclaims we must not copy.
- Community: top questions in provider groups this month; feed the content backlog.
- Record findings in `product/market/log.md` with dates and links.

## SEO content strategy (Phase 6)

- Target the exact questions providers search: registration cost, verification vs certification, which policies are needed, SIL mandatory registration, worker screening, mid-term audit, platform providers, what auditors ask.
- One article per question, 800 to 1,500 words, sourced to Commission pages with dates, updated when the source changes (show "last reviewed" date). Plain English, Australian spelling, no claims language.
- Each article ends with the questionnaire as the next step, not a hard sell. Include a short "general information, not legal advice" line.
- Technical: MDX in the repo, sitemap, canonical URLs, Open Graph, structured data (Article, FAQ), fast on mobile.
- Measure article sessions and click-through; retire or merge articles that do not earn traffic after three months.

## Launch plan outline

1. Pre-launch: ABN registered, brand name cleared (ASIC and IP Australia), terms, privacy, refunds and AI disclosure pages, Stripe live mode with test purchases, support email, status page or uptime check.
2. Soft launch: ten articles live, questionnaire public, pack purchasable, subscription purchasable; five friendly providers invited for feedback.
3. Launch posts in provider groups (honest, admin-approved), one per group, with the free questionnaire as the hook.
4. Weekly for the first eight weeks: review metrics, support themes, claims and privacy checks, one improvement shipped.

## Writing for Haider (decisions that cost money, legal or scope)

Present options as a short table: option, cost, risk, what we learn, recommendation. One paragraph of context. Ask for a one-line answer. Record the answer in `DECISIONS.md`.

Related skills: `product-owner` to turn decisions into REQs, `ux-researcher` for evidence, `ui-ux-designer` for pricing page and flows, `cyber-security` and `release-gate` before anything goes live.
