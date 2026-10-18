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
  // REQ-012 FR-4a (D-2905, the lawyer's read L1, L3, L4): promises about the customer's
  // outcome. Each is a promise, not a description: "certified providers have a mid-term
  // audit" describes the sector; "certified documents" claims a status for ours.
  {
    id: "compliant-promise",
    pattern:
      /\b(?:you(?:'ll|\s+will)?\s+(?:be|are|become|stay|remain)|makes?\s+you|keeps?\s+you|your\s+(?:business|organisation|service)\s+(?:is|will\s+be|becomes?))\s+(?:fully\s+)?compliant\b/gi,
    why: "Compliance is the auditor's and the Commission's finding, never ours to promise.",
  },
  {
    id: "certified-claim",
    pattern:
      /\b(?:we|readyline|our\s+\w+)\s+certif(?:y|ies)\b|\bcertified\s+(?:documents?|policies|policy|pack|templates?|set|by\s+us|compliant)\b/gi,
    why: "Only an approved quality auditor certifies, and only a provider, never a document.",
  },
  {
    id: "audit-ready-promise",
    pattern:
      /\b(?:you(?:'ll|\s+will)?\s+(?:be|are|become|stay|remain)|makes?\s+you|keeps?\s+you|gets?\s+you|become)\s+audit[\s-]?ready\b|\baudit[\s-]?ready\s+in\s+\d/gi,
    why: "Audit readiness is a promise about the outcome; the registers and reminders are what we sell.",
  },
  {
    id: "ensures-you",
    pattern: /\bensures?\s+(?:you|your)\b/gi,
    why: "Nothing we provide ensures a customer's outcome.",
  },
  {
    id: "will-pass",
    pattern: /(?<!\bnot\b[^.]{0,40})\bwill\s+pass\b/gi,
    why: "The audit's outcome is the auditor's.",
  },
  {
    id: "ready-to-register",
    pattern: /\bready\s+to\s+register\b/gi,
    why: "Readiness to register is the Commission's judgement on the application, not ours.",
  },
  {
    id: "free-with-fee",
    pattern:
      /\bfree\b[^.!?]{0,40}\b(?:pack|subscription|trial)\b|\b(?:pack|subscription|trial)\b[^.!?]{0,40}\bfree\b|\bfree\b[^.!?]{0,40}\$\s?\d|\$\s?\d[\d,.]*[^.!?]{0,40}\bfree\b/gi,
    why: '"Free" within reach of a price or a paid product reads as a free paid product (ACL 29(1)(i)).',
  },
  // REQ-012 FR-4a (D-2906, L2; D-2942): comparative claims for Readyline
  // against anyone. A comparison between the two audit kinds ("usually the
  // cheaper one") is a fact about the Commission's process and passes. "The
  // only" and "leading" are read with the noun they claim about (a tool, a
  // provider, a service): the generator's lint reuses these rules on the
  // model's replies, where a sole trader writes "I am the only worker".
  {
    id: "comparative",
    pattern:
      /\b(?:cheaper\s+than|cheapest|better\s+than|unlike\s+other|the\s+only\s+(?:tool|platform|product|service|software|app|system|provider|company|way)|(?:market|industry|australia'?s|the|a)[\s-]+leading\s+(?:\w+\s+)?(?:tool|platform|product|service|software|app|system|provider|company|compliance))\b/gi,
    why: "A comparative claim needs a substantiated comparison we do not make.",
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
