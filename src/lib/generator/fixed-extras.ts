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
          "[Describe the interest or relationship]",
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
        [
          "Service agreements and support plans",
          "[Provider to confirm: period set by the Rules and your state]",
          "[Location]",
        ],
        [
          "Incident and complaint records",
          "[Provider to confirm]",
          "[Location]",
        ],
        [
          "Worker files, screening and training records",
          "[Provider to confirm]",
          "[Location]",
        ],
        ["Financial records", "[Provider to confirm]", "[Location]"],
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
          "[What was raised; what we did; dates]",
          "[Outcome; what we changed]",
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
    {
      type: "paragraph",
      text: `${ctx.facts.tradingName} checks this register each month and renews every clearance before it expires. A worker in a risk-assessed role does not work until their clearance is current.`,
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
  "training-register": () => [
    {
      type: "table",
      columns: ["Worker role", "Training", "Completed", "Refresher due"],
      rows: [
        ["[Role]", "NDIS worker orientation module", "[Date]", "[Date]"],
        ["[Role]", "Infection prevention and control", "[Date]", "[Date]"],
        [
          "[Role]",
          "[Other training required for the supports delivered]",
          "[Date]",
          "[Date]",
        ],
      ],
    },
  ],
  "improvement-register": () => [
    {
      type: "table",
      columns: ["Source", "Improvement", "Owner and due date", "Done"],
      rows: [
        [
          "[Complaint / incident / audit / feedback]",
          "[What we changed]",
          "[Owner] [Date]",
          "[Date]",
        ],
      ],
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
    {
      type: "paragraph",
      text: "The Commission has published a position on the use of AI by providers; we keep its current statement with this policy and follow it.",
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
