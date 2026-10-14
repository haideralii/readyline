/**
 * Fixed text for the document-specific sections (REQ-005 Session D content,
 * delivered in Session C): register tables, forms, checklists and template
 * bodies, in the house style. Every register uses reference codes and never a
 * participant's name or health details (CLAUDE.md 4.5). Regulatory
 * timeframes are not restated here: the Rules set them and the Commission's
 * current guidance is kept with the procedure (CLAUDE.md 4.6).
 */
import type { Block } from "./section-schema";
import type { FixedContext } from "./fixed-text";

const NO_PARTICIPANT_DETAILS =
  "We record a reference code for each person, never a name, date of birth, NDIS number, address or health detail.";

type Extra = (ctx: FixedContext) => Block[];

/**
 * NDIS watch 13 Oct 2026 item A3 (batch 35): the Commission's only published
 * position on providers' use of AI, named rather than alluded to. Source:
 * "Position statement: Use of artificial intelligence in development of
 * behaviour support plans" (February 2026), read 13 October 2026.
 */
export const AI_POSITION_STATEMENT =
  "The Commission's position statement on AI in behaviour support plans (February 2026) says no participant personal information should go into an AI system and that a person, not the tool, makes every decision about a participant. We apply that rule to every AI and digital tool we use.";

/**
 * NDIS watch 13 Oct 2026 item 10 (batch 35): Privacy Act APP 1.7 to 1.9
 * (Privacy and Other Legislation Amendment Act 2024) from 10 December 2026.
 * Source: OAIC fact sheet, September 2026, read 13 October 2026,
 * https://www.oaic.gov.au/__data/assets/pdf_file/0021/269013/APP-1.7-1.9-Transparency-Obligation-Fact-Sheet.PDF
 */
export const AUTOMATED_DECISIONS_SENTENCE =
  "If we use a computer program, including an AI tool, to make or help make a decision that could significantly affect a person, this policy says what personal information it uses and what kinds of decisions it is used for.";

/**
 * Batch 42 item 1 (D-546): the only phone numbers, email addresses and
 * web addresses a document may carry, all from the fixed contact block;
 * the contact-details lint allows these strings and nothing else.
 */
export const COMMISSION_CONTACT_STRINGS: readonly string[] = [
  "1800 035 544",
  "133 677",
  "contactcentre@ndiscommission.gov.au",
  "ndiscommission.gov.au",
];

export const FIXED_EXTRAS: Record<string, Extra> = {
  "risk-register": () => [
    {
      type: "paragraph",
      text: "We rate each risk by how likely it is and how serious the harm could be, record what we do about it, and review it on the date set.",
    },
    {
      type: "table",
      columns: ["Risk", "Rating", "What we do", "Owner and review date"],
      rows: [
        [
          "Example: a worker is unavailable at short notice",
          "Medium",
          "Backup worker list; continuity of supports plan",
          "[Owner] [Date]",
        ],
        ["[Risk]", "[Low / Medium / High]", "[Treatment]", "[Owner] [Date]"],
      ],
    },
  ],
  declarations: (ctx) => [
    {
      type: "paragraph",
      text: `Anyone who works with ${ctx.facts.tradingName} declares a conflict of interest as soon as they become aware of it, in writing, using this form.`,
    },
    {
      type: "table",
      columns: [
        "Who declares",
        "Nature of the conflict",
        "How it is managed",
        "Date and review",
      ],
      rows: [
        [
          "[Name and role]",
          "[nature of the conflict]",
          "[Steps agreed]",
          "[Date] [Review date]",
        ],
      ],
    },
    {
      type: "paragraph",
      text: "We keep every declaration in the conflict of interest register and tell the participant how the conflict is managed when it affects their supports.",
    },
  ],
  "consent-form": () => [
    {
      type: "paragraph",
      text: "We ask for consent before we collect, use or share personal information, and before any audio or visual recording. The form is completed with the participant or their representative and kept in their file.",
    },
    {
      type: "table",
      columns: ["Item", "Consent given", "Notes"],
      rows: [
        [
          "Collecting and storing personal information for supports",
          "[Yes / No]",
          "[Notes]",
        ],
        [
          "Sharing information with named people or services",
          "[Yes / No]",
          "[Who]",
        ],
        ["Audio or visual recording", "[Yes / No]", "[Purpose]"],
        [
          "Use of digital tools that handle de-identified information",
          "[Yes / No]",
          "[Tools]",
        ],
      ],
    },
    {
      type: "paragraph",
      text: "Consent can be withdrawn at any time by telling any worker; we record the withdrawal the same day.",
    },
  ],
  "retention-schedule": () => [
    {
      type: "paragraph",
      text: "We keep each record for at least the period below, or longer where a law, a funding agreement or a complaint requires it, then destroy it securely.",
    },
    {
      type: "table",
      columns: ["Record", "Kept for", "Where"],
      rows: [
        ["Service agreements and support plans", "[period]", "[Location]"],
        // NDIS watch 13 Oct 2026 item 4 (batch 35): Incident Rules F2018L00633 s 25(2), read 13 October 2026, https://www.legislation.gov.au/F2018L00633/latest/text.
        [
          "Reportable incident records",
          "7 years from the date we notified the Commission (Incident Rules s 25)",
          "[Location]",
        ],
        ["Other incident and complaint records", "[period]", "[Location]"],
        [
          "Worker files, screening and training records",
          "[period]",
          "[Location]",
        ],
        ["Financial records", "[period]", "[Location]"],
      ],
    },
  ],
  register: (ctx) => [
    {
      type: "paragraph",
      text: `${ctx.facts.tradingName} keeps this register up to date. ${NO_PARTICIPANT_DETAILS}`,
    },
    {
      type: "table",
      columns: [
        "Reference",
        "Date received",
        "Summary and actions",
        "Outcome and improvement",
      ],
      rows: [
        [
          "[C-001]",
          "[Date]",
          "[summary and actions]",
          "[Outcome; what we changed]",
        ],
      ],
    },
  ],
  // Batch 42 item 1 (D-546): the Commission's contact details as fixed text,
  // read by the PO from https://www.ndiscommission.gov.au/contact-us on
  // 14 October 2026; the NDIS watch re-checks this block. A tailored section
  // refers to it by heading and may not carry a phone number, email or URL.
  "commission-contact": () => [
    {
      type: "paragraph",
      text: "Anyone can contact the NDIS Quality and Safeguards Commission directly, at any time, without telling us first.",
    },
    {
      type: "table",
      columns: ["How", "Detail"],
      rows: [
        [
          "Phone",
          "1800 035 544, Monday to Friday, 9 am to 5 pm (Western Australia 7:30 am to 3:30 pm), closed on public holidays",
        ],
        ["TTY", "133 677"],
        [
          "National Relay Service",
          "Call the relay service and ask for 1800 035 544",
        ],
        ["Email", "contactcentre@ndiscommission.gov.au"],
        ["Website", "ndiscommission.gov.au"],
      ],
    },
  ],
  // Batch 42 item 4 (D-548): the restrictive practice position every pack
  // takes. The five regulated practices are the NDIS (Restrictive Practices
  // and Behaviour Support) Rules 2018 s 6 in plain words; the notification
  // windows are the Incident Rules ss 20 and 21 as in the escalation table.
  // The watch should confirm the s 6 wording against legislation.gov.au.
  "restrictive-practice-position": (ctx) => [
    {
      type: "paragraph",
      text: `${ctx.facts.tradingName} does not use a restrictive practice unless it is in a behaviour support plan and authorised under the rules of the state or territory we work in.`,
    },
    {
      type: "paragraph",
      text: "A restrictive practice is anything that limits a person's rights or freedom of movement. The rules name five kinds: seclusion (keeping a person alone in a room or space they cannot leave), chemical restraint (medication to control behaviour, not to treat a health condition), mechanical restraint (a device that stops a person moving), physical restraint (holding a person to stop them moving) and environmental restraint (stopping a person reaching things or places, such as a locked door, a locked cupboard or a withheld item).",
    },
    {
      type: "paragraph",
      text: "A locked door, a withheld phone or snack, or a held arm can be a restrictive practice even when nobody meant it to be. We treat it as one.",
    },
    {
      type: "steps",
      items: [
        "If a worker uses a restrictive practice in an emergency to keep someone safe, the worker keeps the person safe first and stops the practice as soon as the danger has passed.",
        "The worker tells the owner the same day and records what happened in the incident register before the end of the shift.",
        "The owner reports the use to the Commission as an unauthorised restrictive practice: within 5 business days, or within 24 hours if the person was harmed (the escalation table in our incident management policy holds the rule).",
        "The owner reviews what led to it within 5 business days and records what we change in the improvement register.",
      ],
    },
    {
      type: "paragraph",
      text: "The owner reviews this position every 12 months and whenever a participant's needs change in a way that could lead to a restrictive practice.",
    },
  ],
  // Batch 40 item 3 (D-545): the escalation pathway as fixed text, so the
  // Commission's windows are quoted once, from the primer (Incident Rules
  // F2018L00633 ss 20, 21, read 13 October 2026), and the tailored procedure
  // refers to this table (R-7).
  "escalation-pathway": (ctx) => [
    {
      type: "paragraph",
      text: `This is who tells whom at ${ctx.facts.tradingName}, and by when, for every incident. The role names match the responsibilities table.`,
    },
    {
      type: "table",
      columns: ["Who", "Tells whom", "By when"],
      rows: [
        [
          "The worker on shift",
          "The key person on duty",
          "Straight away, and before the end of the shift in the incident register",
        ],
        ["The key person on duty", "The owner", "The same day"],
        [
          "The owner",
          "The Commission, for death, serious injury, abuse or neglect, unlawful sexual or physical contact, sexual misconduct, or an unauthorised restrictive practice that caused harm",
          "Within 24 hours of becoming aware (Incident Rules s 20), with the full report within 5 business days",
        ],
        [
          "The owner",
          "The Commission, for an unauthorised restrictive practice that caused no harm",
          "Within 5 business days, in writing (Incident Rules s 21)",
        ],
        [
          "The owner",
          "The participant and the people they choose",
          "The same day, with the open-disclosure words in this procedure",
        ],
        [
          "The owner",
          "The improvement register",
          "Within 5 business days of closing the incident",
        ],
      ],
    },
  ],
  "reportable-incidents": () => [
    {
      type: "paragraph",
      text: "Some incidents must be reported to the Commission. The categories and the timeframes are set by the NDIS (Incident Management and Reportable Incidents) Rules 2018 and the Commission's guidance, which we keep with this procedure and follow as published.",
    },
    {
      type: "paragraph",
      text: "When an incident may be reportable, the key person on duty checks the Commission's current list the same day, reports through the Commission's portal within the timeframe the Rules set, records the report reference in the incident register, and keeps the participant and their supporters informed.",
    },
  ],
  procedure: () => [
    {
      type: "steps",
      items: [
        "Make sure everyone is safe and get medical help if needed.",
        "Tell the key person on duty straight away.",
        "Record the incident in the register the same day, using a reference code.",
        "Check whether it is reportable and report it within the timeframe the Rules set.",
        "Support the participant and tell their supporters what happened and what we are doing.",
        "Review the incident, record the cause and the changes we make, and close it.",
      ],
    },
  ],
  "clearance-register": (ctx) => [
    // NDIS watch 13 Oct 2026 items 5 and A2 (batch 35): the Commission's renewal-cycle FAQ (January 2026,
    // https://www.ndiscommission.gov.au/sites/default/files/2026-01/FAQs%20%E2%80%93%20NDIS%20Worker%20Screening%20Check%20Renewal%20Cycle%20External.docx)
    // and the Queensland, ACT and Tasmanian screening pages, all read 13 October 2026.
    {
      type: "paragraph",
      text: `${ctx.facts.tradingName} links every screened worker to our record in the NDIS Worker Screening Database and unlinks workers who leave. We check this register each month and start each renewal at least 90 days before the clearance expires. If a clearance expires, the worker stops risk-assessed work that day until a new clearance is issued.`,
    },
    {
      type: "paragraph",
      text: "In Queensland, the ACT and Tasmania the NDIS clearance is issued with, or inside, the state's children's or vulnerable-people card; record the NDIS clearance number and expiry separately from the card.",
    },
    {
      type: "table",
      columns: [
        "Worker role",
        "Clearance type and number",
        "Expiry",
        "Next check",
      ],
      rows: [
        [
          "[Role]",
          "[NDIS worker screening clearance] [Number]",
          "[Date]",
          "[Date]",
        ],
      ],
    },
  ],
  // Batch 45 item 15 (provider review): the recruitment and referee steps are
  // written for workers; the owner with no workers is told, in one sentence,
  // whom they apply to, rather than reading them as if they had a team.
  "first-recruit": (ctx) => [
    {
      type: "paragraph",
      text:
        ctx.facts.workerCountBand === "sole"
          ? "Until we employ anyone, these steps apply to the first person we recruit."
          : "These steps apply to every worker and key person we recruit, and to the referees we contact about them.",
    },
  ],
  "training-register": () => [
    {
      type: "table",
      columns: ["Worker role", "Training", "Completed", "Refresher due"],
      rows: [
        ["[Role]", "NDIS worker orientation module", "[Date]", "[Date]"],
        ["[Role]", "Infection prevention and control", "[Date]", "[Date]"],
        ["[Role]", "[other training]", "[Date]", "[Date]"],
      ],
    },
  ],
  "improvement-register": () => [
    {
      type: "table",
      columns: ["Source", "Improvement", "Owner and due date", "Done"],
      rows: [["[source]", "[What we changed]", "[Owner] [Date]", "[Date]"]],
    },
  ],
  "support-plan-template": () => [
    {
      type: "paragraph",
      text: "We complete a support plan with each participant before supports start and review it at least every 12 months, or sooner when their needs change. The completed plan stays in the participant's file; this template holds no personal details.",
    },
    {
      type: "table",
      columns: ["Section", "What we record"],
      rows: [
        [
          "Goals and preferences",
          "What the participant wants from their supports, in their words",
        ],
        [
          "Supports and how they are delivered",
          "Each support, who delivers it, how often, and any equipment",
        ],
        [
          "Risk assessment",
          "Risks to the participant and to workers, and how we reduce them",
        ],
        [
          "Preventative health",
          "Health needs we help with and who else is involved",
        ],
        ["Emergency responses", "What to do and who to call in an emergency"],
        [
          "Communication",
          "How the participant communicates and who supports their decisions",
        ],
        ["Review", "Date of the next review and who takes part"],
      ],
    },
  ],
  "transition-checklist": () => [
    {
      type: "bullets",
      items: [
        "Agree the transition plan with the participant and the people they choose.",
        "Confirm the date and who is responsible for each step.",
        "With consent, hand over the records the new provider needs.",
        "For a temporary transition such as a hospital stay, agree how supports resume.",
        "Check in after the transition and record what happened.",
      ],
    },
  ],
  "approved-tools": () => [
    {
      type: "table",
      columns: ["Tool category", "Allowed use", "Not allowed", "Approved by"],
      rows: [
        [
          "General AI assistants",
          "Drafting our own documents with no participant information",
          "Any participant information, even partial",
          "[Owner role]",
        ],
        [
          "Rostering and record systems",
          "As set up for our business",
          "Sharing logins",
          "[Owner role]",
        ],
        ["[Other tool]", "[Use]", "[Limits]", "[Owner role]"],
      ],
    },
  ],
  "participant-information": () => [
    {
      type: "paragraph",
      text: "We do not put a participant's personal, health or disability information into any AI tool. If a tool is needed for a participant task, we first remove every identifier and have the participant's consent, and a worker checks the output before it is used.",
    },
    // NDIS watch 13 Oct 2026 item A3 (batch 35): the Commission's position statement PDF (February 2026,
    // https://www.ndiscommission.gov.au/sites/default/files/2026-02/Position%20statement%20-%20Use%20of%20artificial%20intelligence%20in%20development%20of%20behaviour%20support%20plans.pdf), read 13 October 2026.
    {
      type: "paragraph",
      text: AI_POSITION_STATEMENT,
    },
  ],
  "de-identification": () => [
    {
      type: "bullets",
      items: [
        "Remove names, initials and nicknames.",
        "Remove dates of birth, NDIS numbers, addresses, phone numbers and email addresses.",
        "Remove health conditions, medications and diagnoses unless the task needs them and consent covers it.",
        "Replace each person with a reference code and keep the code list outside the tool.",
        "Check the output for anything that could identify the person before it is used.",
      ],
    },
  ],
  // REQ-016 S-6: the two standalone AI documents folded into the privacy policy as one section.
  "ai-and-digital-tools": (ctx) => [
    {
      type: "paragraph",
      text: `${ctx.facts.tradingName} uses digital and AI tools only as set out here. [name], [role], is accountable for this section, approves each tool before it is used, and reviews this list at every review of this policy.`,
    },
    {
      type: "table",
      columns: ["Tool category", "Allowed use", "Not allowed", "Approver"],
      rows: [
        [
          "General AI assistants",
          "Drafting our own documents with no participant information",
          "Any participant information, even partial",
          "[role]",
        ],
        [
          "Rostering and record systems",
          "As set up for our business",
          "Sharing logins",
          "[role]",
        ],
        ["[other tool]", "[allowed use]", "[limits]", "[role]"],
      ],
    },
    {
      type: "paragraph",
      text: "We do not put a participant's personal, health or disability information into any AI tool. If a tool is needed for a participant task, we first remove every identifier, we have the participant's consent, and a worker checks the output before it is used. We tell each participant when an AI tool has been used for something about them.",
    },
    {
      type: "bullets",
      items: [
        "Remove names, initials and nicknames.",
        "Remove dates of birth, NDIS numbers, addresses, phone numbers and email addresses.",
        "Remove health conditions, medications and diagnoses unless the task needs them and consent covers it.",
        "Replace each person with a reference code and keep the code list outside the tool.",
        "Check the output for anything that could identify the person before it is used.",
      ],
    },
    {
      type: "paragraph",
      text: `A mistake with a tool, such as participant information entered by accident, is recorded in the incident register the same day and handled under our incident management procedure. ${AI_POSITION_STATEMENT}`,
    },
    {
      type: "paragraph",
      text: AUTOMATED_DECISIONS_SENTENCE,
    },
  ],
  "use-register": () => [
    {
      type: "paragraph",
      text: `We record every use of a regulated restrictive practice so that we can report it to the Commission as the Rules require. ${NO_PARTICIPANT_DETAILS}`,
    },
    {
      type: "table",
      columns: [
        "Reference",
        "Practice and authorisation",
        "Date, time and duration",
        "Reported",
      ],
      rows: [
        [
          "[P-001]",
          "[Practice] [Authorisation reference]",
          "[Date] [Time] [Duration]",
          "[Date reported]",
        ],
      ],
    },
  ],
  "agreement-template": () => [
    {
      type: "paragraph",
      text: "The service and tenancy agreement sets out the dwelling, the rent and other charges, the rights and responsibilities of each party, how repairs and maintenance are handled, how either party may end the agreement, and how disputes are raised. We ask a lawyer to review the completed template before first use.",
    },
    {
      type: "table",
      columns: ["Clause", "What it covers"],
      rows: [
        [
          "Parties and dwelling",
          "Who the agreement is between and which enrolled dwelling it concerns",
        ],
        [
          "Term and charges",
          "Start date, rent and other charges, and how they change",
        ],
        [
          "Rights and responsibilities",
          "Privacy, visitors, modifications, repairs and conduct",
        ],
        ["Ending the agreement", "Notice periods and reasons, for each party"],
        ["Disputes", "How to raise a concern with us and with the Commission"],
      ],
    },
  ],
  "agreement-templates": () => [
    {
      type: "paragraph",
      text: "We keep the support agreement and the tenancy or housing agreement separate so a participant can change one without losing the other. Each is explained in a way the participant understands before it is signed.",
    },
    {
      type: "table",
      columns: ["Agreement", "Main clauses"],
      rows: [
        [
          "Supports",
          "Supports provided, how they are delivered, costs, how to raise concerns, ending the agreement",
        ],
        [
          "Tenancy or housing",
          "Dwelling, charges, rights and responsibilities, repairs, ending the agreement, disputes",
        ],
      ],
    },
  ],
};

/** Section ids in the catalogue that map to a shared fixed extra. */
export const EXTRA_ALIASES: Record<string, string> = {
  "clearance-register": "clearance-register",
  "training-register": "training-register",
  "complaints-register": "register",
  "incident-register": "register",
  "complaints-procedure": "procedure",
  "incident-procedure": "procedure",
};

export function fixedExtra(
  sectionId: string,
  ctx: FixedContext,
): Block[] | null {
  const key = EXTRA_ALIASES[sectionId] ?? sectionId;
  const fn = FIXED_EXTRAS[key];
  return fn ? fn(ctx) : null;
}
