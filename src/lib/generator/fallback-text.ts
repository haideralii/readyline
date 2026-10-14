/**
 * A complete generic version of every tailored section (REQ-016 FR-0b): when
 * the model fails twice, the document ships with this text, marked "Generic
 * text: add your details", never with a blank. Written in the house style
 * from the provider's facts and the document's purpose, so even the generic
 * text names the business, its supports and its states. Blanks follow S-8:
 * at most four words naming the missing fact, inside a complete sentence.
 */
import type { ContextPack } from "./context-pack";
import { lintErrors, lintText } from "./lint";
import { blocksToText, type Block } from "./section-schema";

export const GENERIC_MARKER = "Generic text: add your details.";

function joinNames(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function supports(pack: ContextPack): string {
  return joinNames(pack.facts.supportTypes.map((s) => s.name.toLowerCase()));
}

function states(pack: ContextPack): string {
  return joinNames(pack.facts.states);
}

function workers(pack: ContextPack): string {
  return pack.facts.workerCountBand === "sole"
    ? "the owner, who delivers every support"
    : "every worker, including the owner, employees, contractors and volunteers";
}

function basis(pack: ContextPack): string {
  if (pack.document.basisReason)
    return `It is kept because ${pack.document.basisReason}.`;
  const names = pack.standards.map((s) => s.name);
  return names.length
    ? `It supports the NDIS Practice Standards on ${joinNames(names)}.`
    : "It supports the NDIS Practice Standards that apply to our registration.";
}

function purposeSentence(pack: ContextPack): string {
  const p = pack.document.purpose.trim().replace(/\.$/, "");
  return `This ${pack.document.kind} for ${pack.facts.tradingName} ${p.charAt(0).toLowerCase()}${p.slice(1)}.`;
}

function responsibilitiesTable(pack: ContextPack): Block {
  const sole = pack.facts.workerCountBand === "sole";
  const rows = sole
    ? [
        [
          "Owner",
          "Follows this document, keeps the records and reviews it",
          "Always",
        ],
      ]
    : [
        [
          "Owner or key personnel",
          "Approves this document and checks it is followed",
          "Every review and after any incident or complaint",
        ],
        [
          "Workers",
          "Follow this document and raise any concern",
          "Every shift",
        ],
        ["[role]", "Keeps the records this document names", "As they arise"],
      ];
  return { type: "table", columns: ["Role", "Does what", "When"], rows };
}

function commitments(pack: ContextPack): Block {
  const items = pack.standards.flatMap((s) =>
    s.indicators.slice(0, 3).map((i) => `We ${lowerFirst(stripSubject(i))}`),
  );
  if (items.length) return { type: "bullets", items: items.slice(0, 10) };
  return {
    type: "bullets",
    items: [
      `We follow this ${pack.document.kind} in every support we deliver.`,
      "We tell each participant how we work and listen to what they want.",
      "We keep the records this document names so an auditor can see it in use.",
    ],
  };
}

/** "Each participant is supported to ..." becomes "support each participant to ..." where the indicator starts with a subject; otherwise the text is kept. */
function stripSubject(indicator: string): string {
  const m = indicator.match(
    /^(?:Each|Every|The|All)\s+[^,]{1,60}?\s+(?:is|are)\s+(.*)$/i,
  );
  if (m) return `make sure each participant is ${m[1].replace(/\.$/, "")}.`;
  return indicator.replace(/\.$/, "") + ".";
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** The generic blocks for one section; the caller adds the marker. */
export function genericBlocksFor(pack: ContextPack): Block[] {
  const name = pack.facts.tradingName;
  switch (pack.section.id) {
    case "purpose":
      return [
        { type: "paragraph", text: `${purposeSentence(pack)} ${basis(pack)}` },
      ];
    case "scope":
      return [
        {
          type: "paragraph",
          text: `This document applies to ${workers(pack)} at ${name}, to the supports we deliver (${supports(pack)}) and to every participant we support in ${states(pack)}.`,
        },
      ];
    case "policy-statement":
      return [
        { type: "paragraph", text: `${name} makes these commitments.` },
        commitments(pack),
      ];
    case "how-we-do-this":
    case "steps":
    case "actions":
    case "processes":
      return [
        {
          type: "steps",
          items: [
            `We tell each participant and each worker what this ${pack.document.kind} means for them.`,
            "We follow it in every support and record what we did on the day.",
            "We raise any concern with the owner on the same day.",
            "We fix what went wrong, tell the people affected, and record the change.",
            "We check at each review that the records show this document in use.",
          ],
        },
      ];
    case "responsibilities":
      return [responsibilitiesTable(pack)];
    case "when-this-applies":
      return [
        {
          type: "paragraph",
          text: `This procedure applies whenever ${name} delivers ${supports(pack)} in ${states(pack)}, and whenever a worker is unsure whether it applies.`,
        },
      ];
    case "context":
      return [
        {
          type: "paragraph",
          text: `${name} is a ${pack.facts.structure} delivering ${supports(pack)} in ${states(pack)}. This plan protects the participants we support and the people who deliver that support.`,
        },
      ];
    case "risks-and-scenarios":
      return [
        {
          type: "bullets",
          items: [
            "A worker is unavailable at short notice.",
            "A participant's needs change suddenly.",
            "Our records or systems are not available.",
            "An emergency affects a participant's home or our workplace.",
          ],
        },
      ];
    case "parties":
      return [
        {
          type: "paragraph",
          text: `This agreement is between ${name} (the provider) and [participant reference] (the participant), or their representative [name].`,
        },
      ];
    case "body":
      return [
        {
          type: "paragraph",
          text: `${name} agrees to deliver the supports listed in the participant's plan, in the way the participant wants, and to tell the participant before anything changes. The participant agrees to tell us when something is not working. Either party may end this agreement with [notice period] notice.`,
        },
      ];
    case "introduction":
      return [
        {
          type: "paragraph",
          text: `Every worker at ${name} agrees to follow the NDIS Code of Conduct. This acknowledgement records that each worker has read it and understands what it means for their work.`,
        },
      ];
    case "our-expectations":
      return [
        {
          type: "bullets",
          items: [
            "Treat each participant with respect and listen to their choices.",
            "Keep each participant's information private.",
            "Deliver supports safely and only within your training.",
            "Raise any concern about safety or quality the same day.",
          ],
        },
      ];
    case "principles":
      return [
        {
          type: "bullets",
          items: [
            "Each participant leads decisions about their own life.",
            "Supports are safe, respectful and based on what works.",
            "Workers are trained, supervised and supported.",
            "We learn from incidents, complaints and feedback.",
          ],
        },
      ];
    case "structure":
      return [
        {
          type: "paragraph",
          text: `At ${name}, [role] is accountable for practice governance and reports to the owner. Practice is reviewed at least every review cycle and after any serious incident.`,
        },
      ];
    case "summary":
      return [
        {
          type: "paragraph",
          text: `${name} has assessed itself against each Practice Standard that applies to its registration. The table below shows the standard, the Commission's outcome, the evidence we keep and our status.`,
        },
      ];
    case "how-we-meet":
      return [
        {
          type: "paragraph",
          text: `For each standard we keep the policy that supports it, the records that show it in use, and the training our workers have done. Where a record is not yet in place we say so in the status column and set a date.`,
        },
      ];
    case "plain-language-summary":
      return [
        {
          type: "paragraph",
          text: `This document is about how ${name} works with you. You choose your supports. We listen to you. If something is wrong, tell us or tell [name]. We will fix it.`,
        },
      ];
    default:
      return [
        {
          type: "paragraph",
          text: `${name} follows this section in every support we deliver. The owner keeps it current and tells workers when it changes.`,
        },
      ];
  }
}

/**
 * The whole fallback: the marker, then a complete generic section (FR-0b).
 * The facts are provider-typed data (SR-2): if a fact carries a banned claim
 * or a term the lint refuses, the generic text names "the provider" instead,
 * so a prompt injection in a trading name never reaches a document.
 */
export function genericFallbackBlocks(pack: ContextPack): Block[] {
  let blocks = genericBlocksFor(pack);
  if (lintErrors(lintText(blocksToText(blocks))).length) {
    blocks = genericBlocksFor({
      ...pack,
      facts: { ...pack.facts, tradingName: "the provider" },
    });
  }
  return [{ type: "callout", text: GENERIC_MARKER }, ...blocks];
}
