/**
 * The 38 registration-group pages (REQ-011 batch 31, D-1105): every value
 * on a page is generated from data/standards.json, the applicability rules
 * and the document-set mapping, never typed by hand, so the pages can only
 * say what the questionnaire would say for a provider delivering that one
 * group as a sole trader. Pure: the page templates render what this module
 * returns and the unit test walks all 38.
 */
import {
  deriveApplicability,
  type Applicability,
  type Reason,
} from "@/lib/standards/derive";
import type {
  RegistrationGroup,
  Source,
  StandardsDataset,
} from "@/lib/standards/schema";
import {
  auditTypeDescription,
  groupCategoriesContent,
  groupCategoryId,
  groupDescription,
  groupSynonyms,
  moduleDescription,
} from "@/lib/questionnaire/content";
import { deriveDocumentSet } from "@/lib/questionnaire/document-set";

export type GroupPage = {
  code: string;
  name: string;
  slug: string;
  description: string;
  synonyms: string[];
  category: { id: string; title: string };
  pathway: Applicability["pathway"];
  pathwayLabel: string;
  pathwayDescription: string;
  /** The rule that set the pathway, in the provider's words, with its source. */
  pathwayRule: { text: string; source: Source };
  modules: { id: string; name: string; description: string }[];
  /** Plain notes the rules add for this group (SIL definition, SDA alone, early childhood, platform conditions). */
  notes: { text: string; source: Source; unverified: boolean }[];
  documents: string[];
  registers: string[];
  midTermAudit: {
    applies: boolean;
    monthsAfterRegistration: number;
    prepareFromMonth: number;
  };
  mandatoryFrom: string | null;
  sources: Source[];
  faq: { question: string; answer: string }[];
};

/** "Assistance with daily personal activities" becomes "assistance-with-daily-personal-activities". */
/**
 * Slugs pinned where the name's spelling changed after the URL was published, so no link breaks
 * (QA live b340ee3, report B): 0136 now reads "centre-based" (the Commission's Registration
 * Requirements by Supports and Services document and the group's own description) while the
 * registration-groups list page spells it "centrebased", which the slug keeps.
 */
const PINNED_SLUGS: Record<string, string> = {
  "0136": "group-and-centrebased-activities",
};

/** The group's page slug: the pinned one where there is one, else the name's. */
export function groupSlug(g: { code: string; name: string }): string {
  return PINNED_SLUGS[g.code] ?? groupPageSlug(g.name);
}

export function groupPageSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function sourceById(dataset: StandardsDataset, id: string): Source {
  const s = dataset.sources.find((x) => x.id === id);
  if (!s) throw new Error(`group page: unknown source ${id}`);
  return s;
}

function formatMandatory(iso: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Australia/Sydney",
  }).format(new Date(`${iso}T03:00:00Z`));
}

/** The derivation for one group delivered on its own by a sole trader; 0138 is taken as meeting the SIL definition. */
function applicabilityFor(
  dataset: StandardsDataset,
  g: RegistrationGroup,
): Applicability {
  return deriveApplicability(dataset, {
    groups: [g.code],
    businessStructure: "sole-trader",
    usesRestrictivePractices: false,
    ...(g.moduleIds.includes("sil")
      ? {
          silEligibility: {
            fewHoursOnly: false,
            participantManagesOwnWorkers: false,
          },
        }
      : {}),
  });
}

function pluralDocuments(n: number): string {
  return n === 1 ? "1 document" : `${n} documents`;
}

export function buildGroupPage(
  dataset: StandardsDataset,
  g: RegistrationGroup,
): GroupPage {
  const a = applicabilityFor(dataset, g);
  const set = deriveDocumentSet(a.modules, [g.code], {
    policies: "not-sure",
    incidentRegister: "not-sure",
    complaintsRegister: "not-sure",
    insuranceCertificate: "not-sure",
    workerInductionRecords: "not-sure",
  });
  const pathwayReason = a.reasons.find((r) => r.effect === "pathway")!;
  const noteReasons = a.reasons.filter(
    (r): r is Reason =>
      r.effect === "info" ||
      r.effect === "limit-core" ||
      r.effect === "remove-module",
  );
  const modules = a.modules.map((id) => {
    const m = dataset.modules.find((x) => x.id === id)!;
    return { id, name: m.name, description: moduleDescription(id) ?? "" };
  });
  const categoryId = groupCategoryId(g.code) ?? "other";
  const category = groupCategoriesContent.categories.find(
    (c) => c.id === categoryId,
  );
  const sourceIds = [
    ...new Set([
      ...g.sourceIds,
      pathwayReason.sourceId,
      ...noteReasons.map((r) => r.sourceId),
      ...(a.midTermAudit.applies ? [a.midTermAudit.sourceId] : []),
    ]),
  ];
  const pathwayLabel =
    a.pathway === "verification" ? "verification" : "certification";
  const documents = set.documents.map((d) => d.title);
  const registers = set.registers.map((r) => r.title);
  const mandatory = g.mandatoryFrom
    ? `Yes. Registration for ${g.name.toLowerCase()} (class ${g.code}) has been mandatory since ${formatMandatory(g.mandatoryFrom)}, under the Commission's staged roll-out.`
    : `Not yet under the Commission's staged roll-out, which began with supported independent living and platform providers on 1 July 2026. A provider registers to deliver this group to NDIA-managed participants, and the Commission's mandatory registration page lists the classes as they are added.`;
  const faq = [
    {
      question: `Which audit does ${g.name.toLowerCase()} (class ${g.code}) need?`,
      answer: `A ${pathwayLabel} audit. ${auditTypeDescription(a.pathway)} ${pathwayReason.text}`,
    },
    {
      question: `Which Practice Standards modules apply to class ${g.code}?`,
      answer: `${modules.length === 1 ? "One module" : `${modules.length} modules`}: ${modules.map((m) => m.name).join("; ")}. This page says what each one covers.`,
    },
    {
      question: `Which documents does the pack produce for ${g.name.toLowerCase()}?`,
      answer: `${pluralDocuments(documents.length)} and ${registers.length} registers, drafted from your questionnaire answers for your review. The list is on this page.`,
    },
    {
      question: `Is registration mandatory for ${g.name.toLowerCase()}?`,
      answer: mandatory,
    },
  ];
  return {
    code: g.code,
    name: g.name,
    slug: groupSlug(g),
    description: groupDescription(g.code) ?? "",
    synonyms: groupSynonyms(g.code),
    category: { id: categoryId, title: category?.title ?? "Other" },
    pathway: a.pathway,
    pathwayLabel,
    pathwayDescription: auditTypeDescription(a.pathway),
    pathwayRule: {
      text: pathwayReason.text,
      source: sourceById(dataset, pathwayReason.sourceId),
    },
    modules,
    notes: noteReasons.map((r) => ({
      text: r.text,
      source: sourceById(dataset, r.sourceId),
      unverified: Boolean(r.unverified),
    })),
    documents,
    registers,
    midTermAudit: {
      applies: a.midTermAudit.applies,
      monthsAfterRegistration: a.midTermAudit.monthsAfterRegistration,
      prepareFromMonth: a.midTermAudit.prepareFromMonth,
    },
    mandatoryFrom: g.mandatoryFrom,
    sources: sourceIds.map((id) => sourceById(dataset, id)),
    faq,
  };
}

export function buildGroupPages(dataset: StandardsDataset): GroupPage[] {
  const pages = dataset.registrationGroups.map((g) =>
    buildGroupPage(dataset, g),
  );
  const slugs = new Set<string>();
  for (const p of pages) {
    if (slugs.has(p.slug))
      throw new Error(`group page: duplicate slug ${p.slug}`);
    slugs.add(p.slug);
  }
  return pages.sort((a, b) => a.code.localeCompare(b.code));
}

export function findGroupPage(
  dataset: StandardsDataset,
  slug: string,
): GroupPage | null {
  const g = dataset.registrationGroups.find((x) => groupSlug(x) === slug);
  return g ? buildGroupPage(dataset, g) : null;
}

/** The index: every group under its everyday heading, in the data's order within a heading. */
export function groupPagesByCategory(
  pages: readonly GroupPage[],
): { id: string; title: string; description: string; pages: GroupPage[] }[] {
  return groupCategoriesContent.categories
    .map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      pages: c.codes
        .map((code) => pages.find((p) => p.code === code))
        .filter((p): p is GroupPage => Boolean(p)),
    }))
    .filter((c) => c.pages.length > 0);
}
