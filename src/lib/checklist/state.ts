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
};

/** What a row shows: the stored status, else `drafted` for a generated document, else the pre-fill. */
export type ShownStatus = ChecklistStatus | "drafted";

export type ShownItem = ChecklistItem & {
  status: ShownStatus;
  note: string;
  /** True when the provider has set something (a row exists). */
  stored: boolean;
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
    return { ...item, status, note: row?.note ?? "", stored: Boolean(row) };
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

/**
 * The words for the three stored statuses, one table for the screen and the
 * print sheet so the two cannot drift (retro review of REQ-006, finding 9).
 * The tag and the segmented control use the short words (REQ-015 FR-8); the
 * print sheet the longer ones, with Adopted for a document (FR-2).
 */
export const STATUS_WORDS: Record<
  ChecklistStatus,
  { screen: string; print: string; printDocuments?: string }
> = {
  need: { screen: "Need", print: "Need" },
  "in-progress": { screen: "Doing", print: "In progress" },
  have: { screen: "Done", print: "Have", printDocuments: "Adopted" },
};

/** The short word the screen shows for a status (the tag and the control). */
export function screenLabel(status: ShownStatus): string {
  return status === "drafted" ? "Drafted" : STATUS_WORDS[status].screen;
}

/** The print sheet's label; documents call `have` "Adopted" (FR-2). */
export function statusLabel(
  status: ChecklistStatus,
  group: ChecklistItem["group"],
): string {
  const words = STATUS_WORDS[status];
  return group === "documents" && words.printDocuments
    ? words.printDocuments
    : words.print;
}

export const DRAFTED_LABEL = "Drafted (in your document set, review needed)";
