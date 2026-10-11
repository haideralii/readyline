# Domain primer: NDIS provider registration and audit

Written by the PO from sector knowledge and the research in `CLAUDE.md`. It is a map, not a source. Every item the product relies on must be confirmed against the NDIS Quality and Safeguards Commission (the Commission) and tagged in `data/standards.json` with its source URL and date. Items marked `UNVERIFIED` here are exactly the ones Dev must verify first.

## Who is who

- **NDIA** (National Disability Insurance Agency): runs the scheme, funds participants, owns the NDIS trade mark. Not the regulator of providers.
- **NDIS Quality and Safeguards Commission**: regulates providers, registers them, sets the Practice Standards, runs complaints, reportable incidents, worker screening policy, restrictive practice oversight, and approves the auditors.
- **Approved Quality Auditors (AQAs)**: independent bodies that audit providers against the Practice Standards. Providers choose and pay them. AQAs are expected not to consult to providers they audit.
- **Participants**: people with NDIS plans. Our product never holds their data.
- **Providers**: from a sole-trader support worker to large organisations. Our customer is the small end: 1 to 10 workers.

## Registration pathway (what the customer actually goes through)

1. Decide the **registration groups** (the support types, each with a four-digit code). This drives everything else.
2. Create a Commission portal account (PRODA login) and start the application. `UNVERIFIED`: exact portal steps as of 2026.
3. Complete the **self-assessment** against the applicable Practice Standards; the portal produces an **audit scope document** that the provider gives to AQAs for quotes.
4. Engage an AQA. **Verification audit** (desktop document review) for lower-risk groups; **certification audit** (document review plus site visit, interviews with workers and participants) if any group is higher-risk. If any one group needs certification, the whole registration does.
5. Audit outcome goes to the Commission; the Commission decides, may attach conditions.
6. Registration lasts **three years**; certified providers have a **mid-term audit** at roughly 18 months; renewal audit before expiry.
7. Ongoing obligations: incident management and reportable incidents, complaints management, worker screening, Code of Conduct, record keeping, notifying the Commission of changes, annual declarations. `UNVERIFIED`: current annual declaration requirements.

## Practice Standards structure (to be confirmed and sourced in REQ-001)

- **Core module**, four divisions: Rights and Responsibilities for Participants; Governance and Operational Management; Provision of Supports; Provision of Supports Environment. Each division contains outcomes, each outcome has quality indicators.
- **Supplementary modules** apply by registration group: High Intensity Daily Personal Activities; Specialist Behaviour Support; Implementing Behaviour Support Plans; Early Childhood Supports; Specialised Support Coordination; Specialist Disability Accommodation. `UNVERIFIED`: whether additional modules (e.g. for platform providers or SIL) exist in 2026.
- **Verification module**: a reduced set of requirements for lower-risk registration groups (roughly: HR management, incident management, complaints management, risk management). `UNVERIFIED`: exact content.
- Quality indicators are what auditors test; the self-assessment asks for evidence per indicator.

## Registration groups (seed list, all `UNVERIFIED` until sourced)

Lower-risk, typically verification: 0120 Household Tasks; 0108 Assist Travel/Transport; 0125 Participation in Community, Social and Civic Activities (check); 0117 Development of Daily Living and Life Skills (check); 0106 Assist Life Stage, Transition (check).
Higher-risk, certification: 0107 Assist Personal Activities; 0115 Daily Tasks/Shared Living; 0104 High Intensity Daily Personal Activities; 0110 Specialist Behaviour Support; 0118 Early Intervention Supports for Early Childhood; 0131 Specialist Disability Accommodation; 0132 Specialised Support Coordination; 0133 Specialised Supported Employment.
New mandatory classes from 1 July 2026: 0138 Supported Independent Living; 0137 NDIS digital platform services. Support coordination mandatory registration consulted on but paused.

Dev must build the list from the Commission's published registration-group and audit-requirement material, not from this seed.

## Documents an auditor expects from a small provider (seed, to be refined per module in REQ-005)

Governance and risk: governance policy; risk management policy and risk register; business continuity / continuity of supports; conflict of interest; records management; privacy and information management; quality management and continuous improvement; feedback and complaints policy and register; incident management policy, procedure and register, including reportable incidents; emergency and disaster management.
Workforce: recruitment and screening (NDIS Worker Screening Check for risk-assessed roles, key personnel suitability); training and induction (NDIS Worker Orientation Module "Quality, Safety and You"); code of conduct acknowledgement; supervision and performance; worker records.
Supports: service agreements; participant rights, choice and control, dignity of risk; safeguarding; child safety where relevant; medication management (if applicable); mealtime management (if applicable); waste and infection control; transport; restrictive practices (behaviour support groups only).
Plus (v2): AI use and governance policy; data-handling procedure for AI and digital tools.

## Rules the registers must respect (seed)

- **Reportable incidents** must reach the Commission within 24 hours for death, serious injury, abuse or neglect, unlawful sexual or physical contact, sexual misconduct, and unauthorised use of a restrictive practice; a fuller report within 5 business days; other incidents recorded internally. `UNVERIFIED`: confirm current categories and timeframes against the NDIS (Incident Management and Reportable Incidents) Rules.
- **Complaints**: acknowledged, assessed, resolved, recorded; complainant told of outcome and of the right to go to the Commission.
- **Worker screening**: clearance valid 5 years; expiry tracking is a real audit finding area.
- **Policy review**: typical cycle 12 months or on regulatory change; evidence of review is tested.

## Where small providers fail audits (PO experience plus sector commentary; treat as hypotheses to validate with early customers)

Policies that do not match what the provider actually does; registers that exist but are empty; worker screening gaps; no evidence of staff reading policies; no continuity plan for a sole trader (who covers if you are sick); generic templates with another provider's name left in; no participant feedback evidence; insurance certificate missing or expired.

## Language

Use "participant", never "client" or "patient", in generated documents. Use "worker" for staff. "Provider" for the customer. Australian spelling. Plain English at roughly a Year 8 reading level for policies.
