/**
 * REQ-012 FR-3 (D-2912): the launch review's accessibility settings, shared
 * by the public and the signed-in axe specs so the level, the widths, the
 * schemes and the rulings are one list.
 */

/** WCAG 2.2 AA is 2.0 and 2.1 A and AA plus the 2.2 AA criteria; axe tags them by version. */
export const A11Y_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
] as const;

/** The phone, the tablet and the desktop content width the shell targets (REQ-028). */
export const A11Y_WIDTHS = [360, 768, 1280] as const;

export const SCHEMES = ["light", "dark"] as const;

/**
 * Violations ruled by axe rule id, each with its reason; an empty map means
 * zero violations. A ruling is a reviewed diff here, never a skip in a spec.
 */
export const A11Y_RULINGS: Readonly<Record<string, string>> = {};

type Violation = {
  id: string;
  impact?: string | null;
  help: string;
  nodes: { target: unknown[] }[];
};

/** One line per violation: impact, rule, help and up to three targets. */
export function violationLines(violations: Violation[]): string[] {
  return violations.map(
    (v) =>
      `${v.impact ?? "unknown"}: ${v.id} ${v.help} (${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(" "))
        .join("; ")})`,
  );
}
