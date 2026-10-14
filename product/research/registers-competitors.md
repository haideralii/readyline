# Registers: how competitors sell, deliver and keep them, and where Readyline stands (PO, 14 Oct 2026)

Public pages read on 14 Oct 2026; prices as shown that day. The question: for the AUD 39 a month plan (REQ-009 plus REQ-018), who else sells registers to small providers, how, and what we are missing.

## Who sells registers

AuditCore (auditcore.com.au): one plan, all 11 modules: incidents with Commission notification dates, participant management (plans, risks, support history), worker compliance, behaviour support with restrictive practice registers, document AI, continuous improvement, risk and meetings registers, feedback and complaints, policies with a gap report. Onboarding: upload or type data, AI checks it against the quality indicators, an internal audit report with a corrective action plan, then alerts through the year. Exports an audit pack and Word forms. Price: $350 + GST a month for up to 10 participants, $50 + GST per extra 5, $450 + GST setup, no trial, 1-hour onboarding, monthly, no lock-in.

ONDIS (ondis.au): a compliance operating system: incidents and hazards, feedback (complaints, compliments), risk register, credential records with renewals, training modules by role, a Compliance Monitor that maps evidence to the quality indicators and shows what is missing, reminders and renewal tracking, dashboards. Guided tour at login. Prewritten policies and audits, not generated. Price including GST, monthly: Verification Only $59 (sole providers); Certification $99 (1 to 4 staff), $249 (5 to 10), $499 (11 to 20), $899 (21 to 50); $999+ for 51+.

Auditly (auditly.au): policy suites per year (Verification $695, Certification $1,500, modules $695 each) with a Living Policy Engine that pushes regulatory updates into the tailored policies; the QMS Platform at $395 a month: incident log, feedback and complaints, hazard and risk, continuous improvement registers, custom form builder, automated internal audit schedules, task management, read-only auditor access and one-click export of the master QMS, Azure hosting with MFA; 14-day trial on the QMS only. No sole-trader tier.

Smart Compliance Systems (Effective Policy): $15 + GST per licensed user a month, one casual user included; records and registers, risk and improvement workflows, client and people records, attachments, audit trail, access controls, guided forms with tips, forms that non-licensed people can fill in, email reminders before due dates, matrix reports exported to Excel. The same model is sold as an Excel workbook through Effective Policy (price not shown; about $399 in the webinar).

Template sellers (Provider360, Provider Audit Ready, Bluetail) ship registers as Excel or Word files inside the pack: no reminders, no trail, no evidence of use.

## How the flow works for their user

Sign up, pay monthly, get a guided tour; enter or import participants, workers, policies; the system maps records to the quality indicators and shows gaps; log incidents and complaints as they happen (forms with tips, some open to unlicensed staff); reminders by email before expiries and notification deadlines; a dashboard or score; before the audit, export an audit pack or give the auditor read-only access; an internal audit schedule runs between external audits and feeds the improvement register. Policies come from the same vendor as prewritten or generated sets, and the better ones (Auditly) push regulatory updates into them.

## What Readyline has (REQ-009, REQ-017, REQ-018)

Thirteen registers and a document control register built from the pack; append-only event trails on incidents and complaints; reference codes; participant-data detector and no full names by default; email reminders with the Commission's notification windows; the audit-day page with the twelve records and live states; adopt and circulation ticks; per-register CSV export and the account export; lapse freezes writes with no fee; AUD 39 a month flat. Policies are generated from the provider's own answers and name the registers by their canonical names, which none of the others do at this price. The NDIS watch keeps the rules current but does not yet push changes into an adopted pack.

## Gaps, in the order I would close them

1. One-click audit pack. A single export (zip) of every register, the document control register, the readiness summary PDF and the adopted documents, plus a time-limited read-only auditor link with its own audit-log line. Auditly and AuditCore both sell this; it is the thing a provider needs on the day. Small build on top of the existing exports.
2. Workers can log without the owner. An invited worker role (log an incident or complaint, see their own entries, nothing else) and a no-login "report an incident" link per account that creates a draft row for the owner to confirm. Without this the owner is the bottleneck for every 2-to-10-worker provider, and ONDIS prices by staff for a reason. Needs REQ-004 changes (roles) and RLS tests.
3. Internal self-check between audits. A quarterly guided walk (the checklist plus each register's state) that writes findings into the improvement register with a due date and reminders. Auditly calls it internal audit schedules; ours is a guided path, no AI needed.
4. Hazard and WHS register. Missing, cheap, every competitor has it, and a provider with one vehicle or one SIL house needs it.
5. Import from spreadsheets. CSV import for incidents, complaints, worker checks and risks for providers moving off Excel or a template pack; the same column names as our export.
6. Living policies. When the NDIS watch verifies a rule change, mark the affected adopted documents "review needed" in the document control register with the exact sentence to change, and offer a re-generate of that section. This is Auditly's headline feature and we already have the research agent that detects the change.
7. Pricing by team size, later. AUD 39 flat is right for the sole trader and under every competitor; when worker logins exist, add a team tier (for example AUD 79 for up to 10 workers) rather than per-seat fees. No setup fee, no lock-in, no trial gimmicks.
8. Keep out: participant case records, support plans, rostering, document uploads of participant files. We are not a CRM and we do not hold participant personal information; say so on the pricing page as a feature. Insurance and clearance certificates stay in the provider's own drive; we record the dates and where the file is kept.

Sources: https://auditcore.com.au/ and /pricing; https://ondis.au/; https://auditly.au/ and /pricing; https://smartcompliancesystems.com.au/; product/research/competitors-and-go-to-market.md (13 Oct 2026).
