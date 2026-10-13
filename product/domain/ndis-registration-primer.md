# Domain primer: NDIS provider registration and audit

Written by the PO from sector knowledge and the research in `CLAUDE.md`. It is a map, not a source. Every item the product relies on must be confirmed against the NDIS Quality and Safeguards Commission (the Commission) and tagged in `data/standards.json` with its source URL and date. Items marked `UNVERIFIED` here are exactly the ones Dev must verify first.

## Who is who

- **NDIA** (National Disability Insurance Agency): runs the scheme, funds participants, owns the NDIS trade mark. Not the regulator of providers.
- **NDIS Quality and Safeguards Commission**: regulates providers, registers them, sets the Practice Standards, runs complaints, reportable incidents, worker screening policy, restrictive practice oversight, and approves the auditors.
- **Approved Quality Auditors (AQAs)**: independent bodies that audit providers against the Practice Standards. Providers choose and pay them. AQAs are expected not to consult to providers they audit, and referral fees, commissions, success-based payments and revenue sharing linked to audit referrals are incompatible with their obligations (Regulatory Expectations V1, June 2026; D-109). We therefore never take or pay anything for an audit referral.
- **Participants**: people with NDIS plans. Our product never holds their data.
- **Providers**: from a sole-trader support worker to large organisations. Our customer is the small end: 1 to 10 workers.

## Registration pathway (what the customer actually goes through)

1. Decide the **registration groups** (the support types, each with a four-digit code). This drives everything else.
2. Set up myID (and RAM if you are the principal authority for the business) and start the application in the Commission's Applications Portal; PRODA is being retired. Finish the application within 60 days of starting it or it is deleted. (Commission Applications Portal login page and apply page, read 13 October 2026, https://www.ndiscommission.gov.au/applications-portal-login and https://www.ndiscommission.gov.au/provider-registration/apply-registration; the October 2026 launch of the new combined portal is `UNVERIFIED`.)
3. Complete the **self-assessment** against the applicable Practice Standards; the portal produces an **audit scope document** that the provider gives to AQAs for quotes.
4. Engage an AQA. **Verification audit** (desktop document review) for lower-risk groups; **certification audit** (document review plus site visit, interviews with workers and participants) if any group is higher-risk. If any one group needs certification, the whole registration does.
5. Audit outcome goes to the Commission; the Commission decides, may attach conditions.
6. Registration lasts **three years**; certified providers have a **mid-term audit that must start no later than 18 months into the registration period (our advice: prepare from month 12)**, assessed against the governance and operational management part of the core module plus any standard previously under a corrective action, and any standard the Commissioner names in writing (Rules F2026C00527 s 13B, read 13 October 2026); exempt: individual or partnership early-childhood-only, SDA-only, transitioned providers. Audit ratings are 3, 2, 1, 0. The Commission does not set audit prices (D-106). Renewal audit before expiry. A change of ownership that significantly changes governance triggers a certification audit within three months (s 13BA, in force 1 July 2026).
7. Ongoing obligations: incident management and reportable incidents, complaints management, worker screening, Code of Conduct, record keeping, notifying the Commission of changes, annual declarations. Notify the Commission of changes and events in the approved form as soon as you know they will happen, and at the latest when they happen; a change of ownership that significantly changes governance triggers a certification audit within three months (Rules s 13A and s 13BA, inserted by F2026L00802, in force 1 July 2026; https://www.legislation.gov.au/F2026L00802/asmade/text, read 13 October 2026). `UNVERIFIED`: current annual declaration requirements.

## Practice Standards structure (to be confirmed and sourced in REQ-001)

- **Core module**, four divisions: Rights and Responsibilities for Participants; Governance and Operational Management; Provision of Supports; Provision of Supports Environment. Each division contains outcomes, each outcome has quality indicators.
- **Supplementary modules** apply by registration group: High Intensity Daily Personal Activities; Specialist Behaviour Support; Implementing Behaviour Support Plans; Early Childhood Supports; Specialised Support Coordination; Specialist Disability Accommodation; and, from 1 July 2026, **Supported Independent Living** (four standards: supported decision-making, safeguarding, practice governance, agreements about tenancy, housing and support; published June 2026 with an evidence guide). Confirmed 11 Oct 2026 (D-101, D-102). No platform module exists.
- **Verification module**: four standards for lower-risk registration groups: human resource management, incident management, complaints management, risk management. Confirmed 11 Oct 2026 (D-102).
- Quality indicators are what auditors test; the self-assessment asks for evidence per indicator.
- A review of the core Practice Standards is under way (consultation closed November 2025); no revised standards have been published as at October 2026 (Commission, NDIS Practice Standards reform page, https://www.ndiscommission.gov.au/about-us/ndis-regulatory-reform/ndis-practice-standards-reform, read 13 October 2026).

## Registration groups (corrected 11 Oct 2026 from the Commission's table, see `data/sources/registration-groups.txt` and D-103 to D-105)

Dev's sourcing showed the original seed list was wrong in three places: **0125 Participation in Community, 0117 Development of Daily Living and Life Skills and 0106 Assist Life Stage Transition are all certification**, not lower-risk. The Commission lists 38 classes (0101 to 0138) with an audit type each; mixed verification and certification groups resolve to certification. There is no "platform" supplementary module; 0137 is certification with its modules still `UNVERIFIED` (D-104). Four cases depend on more than the group list and must be questionnaire inputs: SDA-only providers (SDA module without core); individual or partnership early-childhood-only providers ("modified certification"); any use of restrictive practices (adds the implementing behaviour support plans module); and whether a provider's service pattern actually falls within 0138 SIL (the Commission's two exclusion questions). 0127 plan management is verification but carries extra worker evidence requirements.

Historical seed list kept below for context only; `data/standards.json` is the source of truth.

### Original seed list (superseded)

Lower-risk, typically verification: 0120 Household Tasks; 0108 Assist Travel/Transport; 0125 Participation in Community, Social and Civic Activities (check); 0117 Development of Daily Living and Life Skills (check); 0106 Assist Life Stage, Transition (check).
Higher-risk, certification: 0107 Assist Personal Activities; 0115 Daily Tasks/Shared Living; 0104 High Intensity Daily Personal Activities; 0110 Specialist Behaviour Support; 0118 Early Intervention Supports for Early Childhood; 0131 Specialist Disability Accommodation; 0132 Specialised Support Coordination; 0133 Specialised Supported Employment.
New mandatory classes from 1 July 2026: 0138 Supported Independent Living; 0137 NDIS digital platform services. Unregistered SIL providers had to apply by 1 October 2026 or stop providing SIL, and a new SIL entrant cannot provide SIL while an application is pending; the platform conditions (Rules s 13D, including worker screening for people using the platform) start 1 January 2027; participants who choose, employ and roster their own workers are outside SIL regardless of their level of support needs (Commission explanatory document, June 2026, and the SIL pathway page, read 13 October 2026). Support coordination mandatory registration consulted on but paused.

Dev must build the list from the Commission's published registration-group and audit-requirement material, not from this seed.

## Documents an auditor expects from a small provider (seed, to be refined per module in REQ-005)

Governance and risk: governance policy; risk management policy and risk register; business continuity / continuity of supports; conflict of interest; records management; privacy and information management; quality management and continuous improvement; feedback and complaints policy and register; incident management policy, procedure and register, including reportable incidents; emergency and disaster management.
Workforce: recruitment and screening (NDIS Worker Screening Check for risk-assessed roles, key personnel suitability); training and induction (NDIS Worker Orientation Module "Quality, Safety and You"); code of conduct acknowledgement; supervision and performance; worker records.
Supports: service agreements; participant rights, choice and control, dignity of risk; safeguarding; child safety where relevant; medication management (if applicable); mealtime management (if applicable); waste and infection control; transport; restrictive practices (behaviour support groups only).
Plus (v2): AI use and governance policy; data-handling procedure for AI and digital tools.

## Rules the registers must respect (seed)

- **Reportable incidents**: death, serious injury, abuse or neglect, unlawful sexual or physical contact, and sexual misconduct must be notified within 24 hours (Rules s 20), with the full report within 5 business days; unauthorised use of a restrictive practice within 5 business days in writing (s 21), or within 24 hours if it caused harm. Keep the record for seven years from the notification (s 25). Other incidents recorded internally. (NDIS (Incident Management and Reportable Incidents) Rules 2018, F2018L00633, as made and unamended, https://www.legislation.gov.au/F2018L00633/latest/text, read 13 October 2026; the harm exception from the Commission's reportable incidents page, read the same day.)
- **Complaints**: acknowledged, assessed, resolved, recorded; complainant told of outcome and of the right to go to the Commission.
- **Worker screening**: clearance valid up to five years from the outcome date; the first clearances began expiring in February 2026, so renewal tracking is live for every provider. Renewals are accepted up to 90 days before expiry; an expired worker must be removed from all risk-assessed roles immediately; providers link workers in the NDIS Worker Screening Database and unlink leavers. Expiry tracking is a real audit finding area. (Commission renewal-cycle FAQ, January 2026, https://www.ndiscommission.gov.au/sites/default/files/2026-01/FAQs%20%E2%80%93%20NDIS%20Worker%20Screening%20Check%20Renewal%20Cycle%20External.docx, read 13 October 2026.)
- **Policy review**: typical cycle 12 months or on regulatory change; evidence of review is tested.

## Where small providers fail audits (PO experience plus sector commentary; treat as hypotheses to validate with early customers)

Policies that do not match what the provider actually does; registers that exist but are empty; worker screening gaps; no evidence of staff reading policies; no continuity plan for a sole trader (who covers if you are sick); generic templates with another provider's name left in; no participant feedback evidence; insurance certificate missing or expired.

## Language

Use "participant", never "client" or "patient", in generated documents. Use "worker" for staff. "Provider" for the customer. Australian spelling. Plain English at roughly a Year 8 reading level for policies.
