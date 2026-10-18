/**
 * The auditor link's pack, rendered once and kept for the link's life
 * (REQ-029 FR-11, D-2863; Dev D-2294): the names of the stored objects, pure.
 * One link holds one zip per period the auditor asks for, under the
 * account's own storage prefix so the account's purge removes it; the
 * default period's pack is made when the link is created, any other on its
 * first download. An auditor who downloads the same period twice gets the
 * same bytes; a new link makes a new render.
 */
import { auditPackFileName } from "./audit-pack";

/** The folder of one link's packs, inside the account's prefix. */
export function linkPackPrefix(accountId: string, linkId: string): string {
  return `${accountId}/auditor-links/${linkId}`;
}

/** "all" for the whole register, else the period's file suffix without its leading dash. */
export function linkPackKey(periodSuffix: string): string {
  return periodSuffix ? periodSuffix.replace(/^-/, "") : "all";
}

/** The stored object's name for a period key and the render day: "all-2026-10-18.zip". */
export function linkPackObjectName(
  periodSuffix: string,
  stamp: string,
): string {
  return `${linkPackKey(periodSuffix)}-${stamp}.zip`;
}

const OBJECT = /^(.*)-(\d{4}-\d{2}-\d{2})\.zip$/;

/** The period key and the render day a stored object's name carries, or null for another file. */
export function parseLinkPackObject(
  name: string,
): { key: string; stamp: string } | null {
  const m = OBJECT.exec(name);
  return m ? { key: m[1], stamp: m[2] } : null;
}

/** Among a link's stored objects, the one for this period, with the file name the download carries. */
export function findLinkPack(
  names: readonly string[],
  periodSuffix: string,
  tradingName: string,
): { name: string; stamp: string; fileName: string } | null {
  const key = linkPackKey(periodSuffix);
  for (const name of names) {
    const parsed = parseLinkPackObject(name);
    if (parsed && parsed.key === key)
      return {
        name,
        stamp: parsed.stamp,
        fileName: auditPackFileName(tradingName, parsed.stamp, periodSuffix),
      };
  }
  return null;
}

/** The cover's line for a stored render (D-2863): the day, and that later changes are not in it. */
export function renderedOnLine(stamp: string): string {
  return `This file was made on ${stamp} for this link and does not change; anything the provider changed after that day is in a newer link's pack.`;
}
