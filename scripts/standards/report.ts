/**
 * Prints the applicable modules, audit pathway, standards and draft evidence
 * for a set of registration groups (REQ-001 FR-5).
 *
 * Usage:
 *   npm run standards:report -- 0120 0107
 *   npm run standards:report -- 0118 --structure=sole-trader
 *   npm run standards:report -- 0138 --sil-few-hours
 *   npm run standards:report -- 0107 --restrictive --no-evidence
 *
 * Flags: --structure=<sole-trader|partnership|company|incorporated-association|trust|other>
 *        --restrictive            provider uses or plans to use regulated restrictive practices
 *        --sil-few-hours          participant only receives a few hours of support a day or week
 *        --sil-self-managed       participant chooses and manages their own support workers
 *        --no-evidence            omit the per-standard evidence list
 *
 * Runs on Node's built-in TypeScript type stripping; no build step.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { StandardsDataset } from "../../src/lib/standards/schema.ts";
import {
  DerivationError,
  applicableStandards,
  deriveApplicability,
  type BusinessStructure,
  type DeriveInput,
} from "../../src/lib/standards/derive.ts";

const STRUCTURES: BusinessStructure[] = [
  "sole-trader",
  "partnership",
  "company",
  "incorporated-association",
  "trust",
  "other",
];

function parseArgs(argv: string[]): {
  input: DeriveInput;
  showEvidence: boolean;
} {
  const groups: string[] = [];
  let businessStructure: BusinessStructure = "sole-trader";
  let usesRestrictivePractices = false;
  let fewHoursOnly = false;
  let participantManagesOwnWorkers = false;
  let showEvidence = true;
  for (const arg of argv) {
    if (/^\d{4}$/.test(arg)) groups.push(arg);
    else if (arg.startsWith("--structure=")) {
      const v = arg.slice("--structure=".length) as BusinessStructure;
      if (!STRUCTURES.includes(v))
        throw new Error(
          `Unknown structure "${v}". Use one of ${STRUCTURES.join(", ")}.`,
        );
      businessStructure = v;
    } else if (arg === "--restrictive") usesRestrictivePractices = true;
    else if (arg === "--sil-few-hours") fewHoursOnly = true;
    else if (arg === "--sil-self-managed") participantManagesOwnWorkers = true;
    else if (arg === "--no-evidence") showEvidence = false;
    else throw new Error(`Unrecognised argument "${arg}".`);
  }
  const input: DeriveInput = {
    groups,
    businessStructure,
    usesRestrictivePractices,
    silEligibility: groups.includes("0138")
      ? { fewHoursOnly, participantManagesOwnWorkers }
      : undefined,
  };
  return { input, showEvidence };
}

function main() {
  const { input, showEvidence } = parseArgs(process.argv.slice(2));
  const dataset = StandardsDataset.parse(
    JSON.parse(
      readFileSync(resolve(process.cwd(), "data/standards.json"), "utf8"),
    ),
  );
  const result = deriveApplicability(dataset, input);
  const standards = applicableStandards(dataset, result);
  const groupName = (code: string) =>
    dataset.registrationGroups.find((g) => g.code === code)?.name ?? "?";
  const moduleName = (id: string) =>
    dataset.modules.find((m) => m.id === id)?.name ?? id;
  const out: string[] = [];

  out.push(
    `Standards report (dataset v${dataset.version}, generated ${dataset.generatedAt})`,
  );
  out.push("");
  out.push("Inputs");
  out.push(
    `  groups: ${input.groups.map((c) => `${c} ${groupName(c)}`).join("; ")}`,
  );
  out.push(`  business structure: ${input.businessStructure}`);
  out.push(
    `  restrictive practices: ${input.usesRestrictivePractices ? "yes" : "no"}`,
  );
  if (input.silEligibility) {
    out.push(
      `  SIL eligibility: few hours only = ${input.silEligibility.fewHoursOnly ? "yes" : "no"}; participant manages own workers = ${input.silEligibility.participantManagesOwnWorkers ? "yes" : "no"}`,
    );
  }
  out.push("");
  out.push(
    `Audit pathway: ${result.pathway}${result.modifiedCertification ? " (modified certification)" : ""}`,
  );
  out.push(`Groups in scope: ${result.groups.join(", ")}`);
  out.push(`Modules (${result.modules.length}):`);
  for (const id of result.modules) {
    const count = standards.filter((s) => s.moduleId === id).length;
    const limited =
      id === "core" && result.coreStandardIds
        ? ` (limited to ${result.coreStandardIds.join(", ")})`
        : "";
    out.push(
      `  - ${id}: ${moduleName(id)}, ${count} standard${count === 1 ? "" : "s"}${limited}`,
    );
  }
  out.push(`Outcomes to self-assess: ${standards.length}`);
  out.push(
    result.midTermAudit.applies
      ? `Mid-term audit: applies ${result.midTermAudit.monthsAfterRegistration} months after registration (prepare from month ${result.midTermAudit.prepareFromMonth}); assessed on core division(s): ${result.midTermAudit.assessedDivisionIds.join(", ")}`
      : `Mid-term audit: does not apply (${result.midTermAudit.exemptReason})`,
  );
  out.push("");
  out.push("Why");
  for (const reason of result.reasons) {
    out.push(
      `  - [${reason.rule}${reason.unverified ? ", UNVERIFIED" : ""}] ${reason.text} (source: ${reason.sourceId})`,
    );
  }

  const unverified = [
    ...dataset.modules
      .filter(
        (m) =>
          result.modules.includes(m.id) &&
          m.verification.status === "unverified",
      )
      .map((m) => `module ${m.id}: ${m.verification.note}`),
    ...dataset.registrationGroups
      .filter(
        (g) =>
          result.groups.includes(g.code) &&
          g.verification.status === "unverified",
      )
      .map((g) => `group ${g.code}: ${g.verification.note}`),
    ...standards
      .filter((s) => s.verification.status === "unverified")
      .map((s) => `standard ${s.id}: ${s.verification.note}`),
    ...result.reasons
      .filter((r) => r.unverified)
      .map((r) => `rule ${r.rule}: ${r.text}`),
  ];
  out.push("");
  out.push(`UNVERIFIED flags: ${unverified.length === 0 ? "none" : ""}`);
  for (const u of unverified) out.push(`  - ${u}`);

  if (showEvidence) {
    out.push("");
    out.push("Evidence guidance");
    out.push(`  ${dataset.evidenceDisclaimer}`);
    out.push(
      "  Items marked [draft] have not yet been reviewed by the product owner.",
    );
    for (const id of result.modules) {
      out.push("");
      out.push(`  ${moduleName(id)}`);
      for (const s of standards.filter((s) => s.moduleId === id)) {
        out.push(`    ${s.id}: ${s.name} (${s.indicators.length} indicators)`);
        for (const e of s.evidence) {
          out.push(`      ${e.draft ? "[draft] " : ""}${e.kind}: ${e.title}`);
        }
      }
    }
  }

  console.log(out.join("\n"));
}

try {
  main();
} catch (e) {
  if (e instanceof DerivationError) {
    console.error(`standards:report: ${e.message}`);
    process.exit(2);
  }
  console.error(
    `standards:report: ${e instanceof Error ? e.message : String(e)}`,
  );
  process.exit(1);
}
