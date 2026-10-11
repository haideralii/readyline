/**
 * Fixed text for every outline section (REQ-005 Session A), written to the
 * house style: first person plural, short sentences, no claims. The model
 * never sees these sections. Document-specific fixed extras (register tables,
 * templates, checklists) get a labelled table or a "[Provider to complete]"
 * placeholder until Session D supplies their text.
 */
import { AI_DISCLOSURE, BRAND, GENERAL_INFORMATION_NOTICE } from "@/lib/brand";
import type { DocumentTypeSpec, SectionSpec } from "./catalogue";
import { describeProvider, type ProviderFacts } from "./facts";
import type { StandardSummary } from "./document-model";
import type { Block } from "./section-schema";

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

export function placeholder(text: string): Block {
  return { type: "callout", text: `[Provider to complete: ${text}]` };
}

/** What a tailored section shows before the model has written it. */
export function placeholderBlocks(spec: SectionSpec): Block[] {
  return [placeholder(`${spec.heading}. ${spec.brief}`)];
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
          rows: [
            ["Document", ctx.type.title],
            [
              "Provider",
              f.abn ? `${f.tradingName} (ABN ${f.abn})` : f.tradingName,
            ],
            ["Version", ctx.version],
            ["Generated", formatDateAu(ctx.generatedAt)],
            ["Approval", "[Provider to complete: name, role and date]"],
            ["Next review", formatDateAu(ctx.reviewDueAt)],
          ],
        },
      ];
    case "definitions":
      return [DEFINITIONS];
    case "records-and-evidence": {
      const titles = uniqueTitles(ctx.standards.flatMap((s) => s.evidence));
      if (titles.length === 0)
        return [
          placeholder(
            "list the records this document creates and where they are kept",
          ),
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
            [
              "[Provider to complete: owner role]",
              "Reviews and approves this document",
              "Every 12 months",
            ],
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
      return [
        {
          type: "paragraph",
          text: "The documents and registers listed below are part of our registration evidence. We mark each one as ready or still to prepare before we book the audit.",
        },
        {
          type: "bullets",
          items: [
            ...ctx.documents.map((d) => d.title),
            ...ctx.registers.map((r) => r.title),
          ].slice(0, 12),
        },
      ];
    case "standards-table":
      return [
        {
          type: "table",
          columns: [
            "Standard",
            "How we meet this",
            "Evidence we keep",
            "Status",
          ],
          rows: ctx.standards
            .slice(0, 20)
            .map((s) => [
              s.name,
              "[Provider to complete]",
              uniqueTitles(s.evidence).slice(0, 3).join("; ") ||
                "[Provider to complete]",
              "[Not started / In progress / Met]",
            ]),
        },
      ];
    default:
      return extraFixedBlocks(spec, ctx);
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
      placeholder(`${spec.heading}. ${spec.brief}`),
    ];
  }
  return [placeholder(`${spec.heading}. ${spec.brief}`)];
}
