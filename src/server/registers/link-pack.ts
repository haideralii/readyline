import "server-only";
/**
 * The auditor link's pack, rendered once and served for the link's life
 * (REQ-029 FR-11, D-2863; D-2294): built with both fills as they stand on
 * the render day, stored under the account's prefix beside the link's id,
 * served from storage on every later download of the same period, and
 * removed when the link is revoked or replaced, when an ended link is
 * purged, and with the account. The cover carries the render day and the
 * zip cover note's two statements (CLAUDE.md 4.2, 4.3: every point of
 * delivery).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { AI_DISCLOSURE, GENERAL_INFORMATION_NOTICE } from "@/lib/brand";
import { log } from "@/lib/logging/logger";
import {
  findLinkPack,
  linkPackObjectName,
  linkPackPrefix,
  renderedOnLine,
} from "@/lib/registers/link-pack";
import { periodFileSuffix, type Period } from "@/lib/registers/period";
import {
  DOCUMENTS_BUCKET,
  downloadObject,
  removePrefix,
  uploadObject,
} from "@/server/generation/storage";
import { buildAuditPack } from "./audit-pack";

export type LinkPackInput = {
  admin: SupabaseClient;
  accountId: string;
  linkId: string;
  tradingName: string;
  period: Period;
  includeRehearsal: boolean;
  now: Date;
};

export type ServedPack = { body: Uint8Array; fileName: string; stamp: string };

/** The stored pack for this link and period, or null when none has been made yet. */
export async function storedLinkPack(
  input: Pick<
    LinkPackInput,
    "admin" | "accountId" | "linkId" | "tradingName" | "period"
  >,
): Promise<ServedPack | null> {
  const prefix = linkPackPrefix(input.accountId, input.linkId);
  const listed = await input.admin.storage
    .from(DOCUMENTS_BUCKET)
    .list(prefix, { limit: 100 });
  const names = (listed.data ?? []).map((o) => o.name);
  const found = findLinkPack(
    names,
    periodFileSuffix(input.period),
    input.tradingName,
  );
  if (!found) return null;
  try {
    const body = await downloadObject(input.admin, `${prefix}/${found.name}`);
    return { body, fileName: found.fileName, stamp: found.stamp };
  } catch (e) {
    log.warn("auditor-link.pack-read-failed", {
      linkId: input.linkId,
      name: e instanceof Error ? e.name : "unknown",
    });
    return null;
  }
}

/** Renders the pack with both fills as they stand and stores it for the link; the stored bytes are what is served. */
export async function renderAndStoreLinkPack(
  input: LinkPackInput,
): Promise<ServedPack> {
  const stamp = input.now.toISOString().slice(0, 10);
  const pack = await buildAuditPack({
    supabase: input.admin,
    admin: input.admin,
    accountId: input.accountId,
    tradingName: input.tradingName,
    now: input.now,
    period: input.period,
    includeRehearsal: input.includeRehearsal,
    cover: {
      renderedLine: renderedOnLine(stamp),
      statements: [GENERAL_INFORMATION_NOTICE, AI_DISCLOSURE],
    },
  });
  const body = new Uint8Array(pack.body);
  const name = linkPackObjectName(periodFileSuffix(input.period), stamp);
  await uploadObject(
    input.admin,
    `${linkPackPrefix(input.accountId, input.linkId)}/${name}`,
    body,
    "application/zip",
  );
  return { body, fileName: pack.fileName, stamp };
}

/** The stored pack when there is one, else a fresh render stored now (the first download of this period). */
export async function linkPackFor(input: LinkPackInput): Promise<ServedPack> {
  return (await storedLinkPack(input)) ?? renderAndStoreLinkPack(input);
}

/** Removes every stored pack of a link (revoked, replaced, purged, or the account deleted). */
export async function removeLinkPacks(
  admin: SupabaseClient,
  accountId: string,
  linkId: string,
): Promise<number> {
  return removePrefix(admin, linkPackPrefix(accountId, linkId));
}
