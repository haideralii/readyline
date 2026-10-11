/**
 * Guardrails for marketing and generated copy (CLAUDE.md sections 4.1 and 4.3).
 *
 * These checks are deterministic so they can run in unit tests over site copy
 * and, from Phase 3, over every generated document before it is rendered.
 */

export type ClaimFinding = {
  /** Stable id for the rule that matched. */
  rule: string;
  /** The offending text as it appeared. */
  match: string;
  /** Zero-based character offset of the match. */
  index: number;
};

type Rule = { id: string; pattern: RegExp; why: string };

/**
 * Phrases that overstate outcomes or imply a relationship with the NDIA or
 * the NDIS Quality and Safeguards Commission. Descriptive use of "NDIS"
 * (for example "aligned to the NDIS Practice Standards") is allowed and is
 * deliberately not matched here.
 */
export const PROHIBITED_CLAIM_RULES: readonly Rule[] = [
  {
    id: "guaranteed-outcome",
    pattern:
      /\bguarantee[ds]?\s+(?:your\s+)?(?:registration|approval|a?\s*pass|audit\s+(?:success|outcome))/gi,
    why: "Registration outcomes are decided by the auditor and the Commission.",
  },
  {
    id: "audit-proof",
    pattern: /\baudit[\s-]?proof\b/gi,
    why: "No document set can be audit-proof.",
  },
  {
    id: "pass-rate",
    pattern: /\b100\s?%\s+(?:pass|success)/gi,
    why: "Pass-rate claims are unverifiable and misleading.",
  },
  {
    id: "approved-by-authority",
    pattern:
      /\bapproved\s+by\s+(?:the\s+)?(?:ndis|ndia|commission|auditors?|approved\s+quality\s+auditors?)\b/gi,
    why: "Implies endorsement by the regulator or auditors.",
  },
  {
    id: "ndis-affiliation",
    pattern:
      /\bndis[\s-]?(?:approved|accredited|endorsed|certified|official|compliant\s+guarantee)\b/gi,
    why: "Implies a relationship with the NDIA or the Commission.",
  },
  {
    id: "official-ndis",
    pattern: /\bofficial\s+ndis\b/gi,
    why: "Implies the product is an official NDIS resource.",
  },
  {
    id: "i-heart-ndis",
    pattern: /\bi\s*(?:heart|love|<3|❤️?)\s*ndis\b/gi,
    why: "The 'I heart NDIS' marks belong to the NDIA.",
  },
  {
    id: "self-described-registered-provider",
    pattern:
      /(?:\bwe|\bour\s+(?:company|business|service)|Readyline)\s+(?:is|are)\s+(?:an?\s+)?(?:ndis[\s-]?)?registered\s+provider/gi,
    why: "We are not a registered provider and must not say so.",
  },
];

/**
 * Returns every prohibited claim found in `text`, in document order.
 * An empty array means the text passed.
 */
export function findProhibitedClaims(text: string): ClaimFinding[] {
  const findings: ClaimFinding[] = [];
  for (const rule of PROHIBITED_CLAIM_RULES) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags);
    for (const m of text.matchAll(re)) {
      findings.push({ rule: rule.id, match: m[0], index: m.index ?? 0 });
    }
  }
  return findings.sort((a, b) => a.index - b.index);
}

/**
 * Throws with a readable message when `text` contains a prohibited claim.
 * Intended for tests and for the generator's output validation step.
 */
export function assertNoProhibitedClaims(text: string, label = "text"): void {
  const findings = findProhibitedClaims(text);
  if (findings.length === 0) return;
  const lines = findings.map((f) => `  [${f.rule}] "${f.match}" at ${f.index}`);
  throw new Error(
    `${label} contains ${findings.length} prohibited claim(s):\n${lines.join("\n")}`,
  );
}

/**
 * The NDIA's trade mark guidelines say "NDIS" must not appear in a business,
 * trading, domain or product name. The placeholder is always allowed.
 */
export function isBrandNameAllowed(name: string): boolean {
  return !/ndis/i.test(name);
}
