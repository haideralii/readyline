/**
 * Fixed text for every outline section (REQ-005 Session A), written to the
 * house style: first person plural, short sentences, no claims. The model
 * never sees these sections. Document-specific fixed extras (register tables,
 * templates, checklists) get a labelled table or a "[Provider to complete]"
 * placeholder until Session D supplies their text.
 */
import { AI_DISCLOSURE, BRAND, GENERAL_INFORMATION_NOTICE } from "@/lib/brand";
import {
  keptBecause,
  type DocumentTypeSpec,
  type SectionSpec,
} from "./catalogue";
import { describeProvider, type ProviderFacts } from "./facts";
import type { StandardSummary } from "./document-model";
import type { Block } from "./section-schema";
import { fixedExtra } from "./fixed-extras";
import { placeholderFor } from "./placeholders";
import {
  AUDIT_RECORD_TIER_TITLES,
  canonicalRecordName,
  itemsToPrepareByTier,
} from "@/lib/registers/names";

export type FixedContext = {
  type: DocumentTypeSpec;
  facts: ProviderFacts;
  standards: StandardSummary[];
  documents: { id: string; title: string }[];
  registers: { id: string; title: string }[];
  version: string;
  generatedAt: string;
  reviewDueAt: string;
};

export function formatDateAu(iso: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Australia/Sydney",
  }).format(new Date(`${iso}T03:00:00Z`));
}

/** A bracketed line for the provider; the text is already in the customer's voice (REQ-016 FR-0a). */
export function placeholder(text: string): Block {
  return { type: "callout", text: text.startsWith("[") ? text : `[${text}]` };
}

/** What a tailored section shows before the model has written it: the customer placeholder, never the brief (FR-0a). */
export function placeholderBlocks(spec: SectionSpec): Block[] {
  return [placeholder(placeholderFor(spec))];
}

const DEFINITIONS: Block = {
  type: "bullets",
  items: [
    "Participant: a person who receives supports from us under the NDIS.",
    "Worker: anyone who delivers or supports the delivery of our services, including the owner, people we employ, contractors and volunteers.",
    "Key personnel: the people who own, run or make decisions for the business.",
    "Provider: our business, named in the document control table.",
    "The Commission: the NDIS Quality and Safeguards Commission, which registers and regulates providers.",
    "Rules: the NDIS rules made under the National Disability Insurance Scheme Act 2013 that apply to registered providers.",
  ],
};

/**
 * The "Why this document" paragraph under the title (D-045): the Practice
 * Standards it supports for this case, or the basis it is kept on when the
 * case is not audited against any of its standards.
 */
export function whyThisDocument(ctx: FixedContext): Block {
  if (ctx.standards.length === 0)
    return { type: "paragraph", text: keptBecause(ctx.type) };
  const names = ctx.standards.map((s) => s.name).join("; ");
  return {
    type: "paragraph",
    text: `Why this document: it supports the NDIS Practice Standards ${names} for ${ctx.facts.tradingName}.`,
  };
}

function uniqueTitles(items: readonly { title: string }[]): string[] {
  return [...new Set(items.map((i) => i.title))];
}

function registerTitles(ctx: FixedContext): string[] {
  const wanted = new Set(ctx.type.registers);
  return ctx.registers.filter((r) => wanted.has(r.id)).map((r) => r.title);
}

export function fixedBlocks(spec: SectionSpec, ctx: FixedContext): Block[] {
  const f = ctx.facts;
  switch (spec.id) {
    case "document-control":
      return [
        {
          type: "table",
          columns: ["Item", "Detail"],
          // REQ-016 S-2: title, provider, version, approved by (name and role), approval date, next review, standards.
          rows: [
            ["Document", ctx.type.title],
            [
              "Provider",
              f.abn ? `${f.tradingName} (ABN ${f.abn})` : f.tradingName,
            ],
            ["Version", ctx.version],
            ["Drafted", formatDateAu(ctx.generatedAt)],
            // "Approver" rather than "approved by": the claims lint bans that phrase in a document (house style, CLAUDE.md 4.3).
            ["Approver", "[name], [role]"],
            ["Approval date", "[date]"],
            ["Next review", formatDateAu(ctx.reviewDueAt)],
            [
              "Standards it supports",
              ctx.standards.length
                ? ctx.standards.map((s) => s.name).join("; ")
                : (ctx.type.basisReason ?? "See below"),
            ],
          ],
        },
        whyThisDocument(ctx),
      ];
    case "definitions":
      return [DEFINITIONS];
    case "records-and-evidence": {
      // Batch 42 item 2 (D-547): the dataset's evidence titles by their canonical register names.
      const titles = uniqueTitles(
        ctx.standards
          .flatMap((s) => s.evidence)
          .map((e) => ({ title: canonicalRecordName(e.title) ?? e.title })),
      );
      if (titles.length === 0)
        // D-045: no standard for this case is not a gap to fill; say why the document is kept.
        return [
          { type: "paragraph", text: keptBecause(ctx.type) },
          {
            type: "paragraph",
            text: "We keep the records this document names, with the dates they were made, so an auditor can see it in use.",
          },
        ];
      return [
        {
          type: "paragraph",
          text: "We keep the following records so an auditor can see this document in use.",
        },
        { type: "bullets", items: titles.slice(0, 12) },
      ];
    }
    case "related-documents": {
      const registers = registerTitles(ctx);
      const blocks: Block[] = [
        {
          type: "paragraph",
          text: `This document is part of the ${f.tradingName} policy set prepared with ${BRAND} on ${formatDateAu(ctx.generatedAt)}.`,
        },
      ];
      if (registers.length) blocks.push({ type: "bullets", items: registers });
      const standards = ctx.standards.map((s) => s.name);
      if (standards.length)
        blocks.push({
          type: "paragraph",
          text: `Practice Standards this document supports: ${standards.join("; ")}.`,
        });
      return blocks;
    }
    case "review":
      return [
        {
          type: "paragraph",
          text: `We review this document every 12 months, after any incident or complaint that shows a gap, and when the Commission changes the rules it supports. Next review: ${formatDateAu(ctx.reviewDueAt)}.`,
        },
        {
          type: "table",
          columns: ["Role", "Does what", "When"],
          rows: [
            ["[role]", "Reviews and approves this document", "Every 12 months"],
            [
              "All workers",
              "Read the current version and follow it",
              "At induction and after each change",
            ],
          ],
        },
      ];
    case "notice":
      return [
        { type: "paragraph", text: GENERAL_INFORMATION_NOTICE },
        { type: "paragraph", text: AI_DISCLOSURE },
      ];
    case "how-to-use":
      return ctx.type.kind === "self-assessment"
        ? [
            {
              type: "paragraph",
              text: "Each row names one Practice Standard that applies to us, the Commission's outcome and quality indicators, how we meet them, and the records an auditor can ask for.",
            },
            {
              type: "paragraph",
              text: "Before the audit we fill in the status column for every row: met, in progress or not started, with the date.",
            },
          ]
        : [
            {
              type: "paragraph",
              text: "Text in square brackets is a placeholder for us to fill in. We do not write any participant's personal information into the template itself; the completed copy for each participant is kept with that participant's records.",
            },
          ];
    case "signatures":
      return [
        {
          type: "table",
          columns: ["Party", "Name", "Signature and date"],
          rows: [
            ["Provider", f.tradingName, "[Signature] [Date]"],
            ["Participant or representative", "[Name]", "[Signature] [Date]"],
          ],
        },
      ];
    case "code-text":
      return [
        {
          type: "paragraph",
          text: "The NDIS Code of Conduct is published by the NDIS Quality and Safeguards Commission and applies to every worker and provider under the NDIS. We give each worker the current Code and the Commission's guidance for workers at induction.",
        },
        {
          type: "paragraph",
          text: "In short, the Code requires each of us to act with respect for individual rights, to respect privacy, to provide supports safely and competently with care and skill, to act with integrity, honesty and transparency, to raise and act on concerns about quality and safety, to take steps to prevent and respond to violence, exploitation, neglect and abuse, and to take steps to prevent and respond to sexual misconduct. The Commission's published text applies, not this summary.",
        },
      ];
    case "acknowledgement":
      return [
        {
          type: "paragraph",
          text: `I have read the NDIS Code of Conduct and the expectations above. I understand what they mean for my work with ${f.tradingName}.`,
        },
        {
          type: "table",
          columns: ["Name", "Role", "Signature and date"],
          rows: [["[Name]", "[Role]", "[Signature] [Date]"]],
        },
      ];
    case "gaps":
      // Batch 42 item 3 (D-547): the twelve records an auditor asks for, in
      // the order the audit-day page asks for them, from the one list.
      // Batch 45 (REQ-018-gated item): the twelve in their two tiers, the
      // two paper records marked, the same words as the audit-day page.
      return [
        {
          type: "paragraph",
          text: 'The records listed below are what an auditor asks to see, in the order they ask. We mark each one as ready or still to prepare before we book the audit. A record marked "kept on paper" is a signed or issued document we keep in our folder; the register holds its dates.',
        },
        {
          type: "paragraph",
          text: `${AUDIT_RECORD_TIER_TITLES.named}: the Rules require the incident and complaints registers, and the Practice Standards expect the rest of these.`,
        },
        { type: "bullets", items: itemsToPrepareByTier().named },
        {
          type: "paragraph",
          text: `${AUDIT_RECORD_TIER_TITLES.practice}: not named by a standard, asked for at most audits.`,
        },
        { type: "bullets", items: itemsToPrepareByTier().practice },
      ];
    case "standards-table": {
      // The Commission's outcome stays verbatim (CLAUDE.md 4.6); tables hold at most 20 rows (D-501).
      const rows = ctx.standards.map((s) => [
        s.name,
        s.outcome,
        uniqueTitles(s.evidence).slice(0, 3).join("; ") ||
          "[Provider to complete]",
        "[Not started / In progress / Met]",
      ]);
      const blocks: Block[] = [
        {
          type: "paragraph",
          text: `This self-assessment covers the ${ctx.standards.length} standards that apply to ${f.tradingName}. The outcome column is the Commission's own wording.`,
        },
      ];
      for (let i = 0; i < rows.length; i += 20) {
        blocks.push({
          type: "table",
          columns: [
            "Standard",
            "Outcome (Commission text)",
            "Evidence we keep",
            "Status",
          ],
          rows: rows.slice(i, i + 20),
        });
      }
      return blocks;
    }
    case "change-log":
      // REQ-016 S-2: version, date, what changed and by whom, seeded with version 1.
      return [
        {
          type: "paragraph",
          text: "We record every change to this document here and tell workers when a new version applies.",
        },
        {
          type: "table",
          columns: ["Version", "Date", "What changed", "By whom"],
          rows: [
            [
              ctx.version,
              formatDateAu(ctx.generatedAt),
              "First version, drafted from our questionnaire answers",
              "[name]",
            ],
          ],
        },
      ];
    case "easy-read":
      // REQ-016 S-4: a marked place; Easy Read is good practice, not a rule.
      return [
        {
          type: "paragraph",
          text: "We keep an Easy Read version of the summary above with this document: one idea per line, with a picture for each idea, in large print.",
        },
        { type: "callout", text: "[Easy Read version]" },
      ];
    default:
      return fixedExtra(spec.id, ctx) ?? extraFixedBlocks(spec, ctx);
  }
}

/** Document-specific fixed sections until Session D writes their text. */
function extraFixedBlocks(spec: SectionSpec, ctx: FixedContext): Block[] {
  const brief = spec.brief.toLowerCase();
  if (/register|columns|table/.test(brief)) {
    return [
      {
        type: "paragraph",
        text: `${ctx.facts.tradingName} keeps this register up to date. We use reference codes, never a participant's name or health details.`,
      },
      {
        type: "table",
        columns: ["Reference", "Date", "Summary", "Action and outcome"],
        rows: [["[Code]", "[Date]", "[Summary]", "[Action and outcome]"]],
      },
    ];
  }
  if (/template|form|checklist|agreement/.test(brief)) {
    return [
      {
        type: "paragraph",
        text: `${describeProvider(ctx.facts)}, uses this template with each participant.`,
      },
      placeholder(placeholderFor(spec)),
    ];
  }
  return [placeholder(placeholderFor(spec))];
}
