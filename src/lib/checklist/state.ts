/**
 * The checklist as shown (REQ-006 FR-2, FR-3): derived items merged with
 * what the provider stored, and with the documents a generated set already
 * drafted. Pure, so the merge rules are unit-tested.
 */
import {
  type Checklist,
  type ChecklistItem,
  type ChecklistStatus,
} from "./derive";

export type StoredItem = {
  itemId: string;
  status: ChecklistStatus;
  note: string;
  /** REQ-023 FR-4: the date a dated audit item was done; null when not recorded. */
  doneOn?: string | null;
};

/** What a row shows: the stored status, else `drafted` for a generated document, else the pre-fill. */
export type ShownStatus = ChecklistStatus | "drafted";

export type ShownItem = ChecklistItem & {
  status: ShownStatus;
  note: string;
  /** True when the provider has set something (a row exists). */
  stored: boolean;
  /** REQ-023 FR-4: the recorded date of a dated item, or null. */
  doneOn: string | null;
};

export type ShownGroup = {
  id: Checklist["groups"][number]["id"];
  title: string;
  items: ShownItem[];
  ready: number;
  /** Open by default: the first group with something still to do (FR-3). */
  open: boolean;
};

export type ShownChecklist = {
  groups: ShownGroup[];
  items: ShownItem[];
  ready: number;
  total: number;
};

export function mergeChecklist(input: {
  checklist: Checklist;
  stored: StoredItem[];
  /** Document type ids present in the account's latest ready set (FR-2 "drafted"). */
  draftedDocumentTypeIds?: readonly string[];
}): ShownChecklist {
  const stored = new Map(input.stored.map((s) => [s.itemId, s]));
  const drafted = new Set(input.draftedDocumentTypeIds ?? []);
  const items: ShownItem[] = input.checklist.items.map((item) => {
    const row = stored.get(item.id);
    let status: ShownStatus = row?.status ?? item.initialStatus;
    if (
      !row &&
      item.documentTypeId &&
      drafted.has(item.documentTypeId) &&
      status === "need"
    )
      status = "drafted";
    return {
      ...item,
      status,
      note: row?.note ?? "",
      stored: Boolean(row),
      doneOn: row?.doneOn ?? null,
    };
  });
  const ready = items.filter((i) => i.status === "have").length;
  let opened = false;
  const groups: ShownGroup[] = input.checklist.groups.map((g) => {
    const groupItems = items.filter((i) => i.group === g.id);
    const groupReady = groupItems.filter((i) => i.status === "have").length;
    const incomplete = groupReady < groupItems.length;
    const open = !opened && incomplete;
    if (open) opened = true;
    return {
      id: g.id,
      title: g.title,
      items: groupItems,
      ready: groupReady,
      open,
    };
  });
  return { groups, items, ready, total: items.length };
}

/** Human labels for the status radio; documents call `have` "Adopted" (FR-2). */
export function statusLabel(
  status: ChecklistStatus,
  group: ChecklistItem["group"],
): string {
  if (status === "need") return "Need";
  if (status === "in-progress") return "In progress";
  return group === "documents" ? "Adopted" : "Have";
}

export const DRAFTED_LABEL = "Drafted (in your document set, review needed)";
