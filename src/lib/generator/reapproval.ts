/**
 * Re-approval (REQ-029 FR-6, D-2855): a changed approver behind an adopted
 * document is a new version, not a silent edit. The new version keeps the
 * stored text as the template (its Approver row, responsibilities role and
 * the new change-log row stay bracketed, so the adoption snapshot of that
 * day fills them at read time) and fixes the earlier change-log rows to the
 * approver who signed them. Pure; the action stores the version and adopts
 * it through `adopt_document_version`, which takes today's snapshot.
 */
import type { DocumentModel, ResolvedSection } from "./document-model";
import { formatDateAu } from "./fixed-text";
import type { Block } from "./section-schema";

/** The change log's "What changed" cell of a re-approval, bracketed so the snapshot fills the role. */
export const REAPPROVAL_CHANGE_TEXT = "Approver changed to [role]; re-approved";

export type ApproverSnapshot = {
  approver_name?: string | null;
  approver_role?: string | null;
};

/**
 * True when the version is adopted with a snapshot and the account's name or
 * role now differs from it. A version adopted before the snapshot existed
 * carries its values in its text (FR-9) and is never re-approved by this
 * rule; an account with no name cannot approve anything (FR-5).
 */
export function needsReapproval(
  row: { adopted_on?: string | null } & ApproverSnapshot,
  facts: Readonly<Record<string, string>>,
): boolean {
  if (!row.adopted_on || !row.approver_name) return false;
  const name = (facts.name ?? "").trim();
  if (!name) return false;
  const role = (facts.role ?? "").trim();
  return (
    row.approver_name.trim() !== name ||
    (row.approver_role ?? "").trim() !== role
  );
}

function fixEarlier(
  text: string,
  previous: { name: string; role: string | null },
): string {
  let out = text.split("[name]").join(previous.name);
  if (previous.role) out = out.split("[role]").join(previous.role);
  return out;
}

function tableRows(block: Block, f: (rows: string[][]) => string[][]): Block {
  return block.type === "table" ? { ...block, rows: f(block.rows) } : block;
}

/**
 * The re-approved version's model: the control table's Version cell and the
 * model's version move to `version`; the earlier change-log rows name the
 * approver who signed them; one new row carries the day, the bracketed
 * change text and "[name]" for the new snapshot to fill.
 */
export function reapprovalModel(
  model: DocumentModel,
  input: {
    version: number;
    /** The day of the re-approval, YYYY-MM-DD (Sydney). */
    today: string;
    /** The snapshot the earlier rows were approved under. */
    previous: { name: string; role: string | null };
  },
): DocumentModel {
  const version = String(input.version);
  const sections: ResolvedSection[] = model.sections.map((s) => {
    if (s.id === "document-control")
      return {
        ...s,
        blocks: s.blocks.map((b) =>
          tableRows(b, (rows) =>
            rows.map((r) =>
              r[0] === "Version" ? [r[0], version, ...r.slice(2)] : r,
            ),
          ),
        ),
      };
    if (s.id === "change-log")
      return {
        ...s,
        blocks: s.blocks.map((b) =>
          tableRows(b, (rows) => [
            ...rows.map((r) => r.map((c) => fixEarlier(c, input.previous))),
            [
              version,
              formatDateAu(input.today),
              REAPPROVAL_CHANGE_TEXT,
              "[name]",
            ],
          ]),
        ),
      };
    return s;
  });
  return { ...model, version, sections };
}
