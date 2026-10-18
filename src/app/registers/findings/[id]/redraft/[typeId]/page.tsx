// REQ-033 Session B FR-B1, FR-B4, FR-B7 (D-2955, D-2957): the redraft page for one finding and one
// document: the finding's words, what the model sees, the one button, then the side-by-side.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { documentTypeById } from "@/lib/generator/catalogue";
import type { FindingRow } from "@/lib/registers/audit-day-types";
import { mapFinding } from "@/lib/registers/findings-map";
import {
  REDRAFT_INTRO,
  REDRAFT_WHAT_IS_SENT,
  noRedraftReason,
} from "@/lib/registers/findings-redraft";
import { latestReadySet } from "@/server/checklist/queries";
import { listDocumentVersions } from "@/server/generation/queries";
import { getAuditDayRow } from "@/server/registers/audit-day-queries";
import { RegisterPage, registerContext } from "../../../../_components/shell";
import { RedraftPanel } from "./redraft-panel";

export const metadata: Metadata = { title: "Redraft a section" };

export default async function Page({
  params,
}: PageProps<"/registers/findings/[id]/redraft/[typeId]">) {
  const { id, typeId } = await params;
  const ctx = await registerContext(
    `/registers/findings/${id}/redraft/${typeId}`,
  );
  const accountId = ctx.viewer.account.id;
  const row = (await getAuditDayRow(
    ctx.supabase,
    accountId,
    "findings",
    id,
  )) as FindingRow | null;
  if (!row) notFound();
  const type = documentTypeById(typeId);
  if (!type) notFound();
  const backHref = `/registers/findings/${id}`;
  const doc = mapFinding(row.standard_id, row.indicator).documents.find(
    (d) => d.typeId === typeId,
  );
  const { setId } = await latestReadySet(ctx.supabase, accountId);
  const latest = setId
    ? (await listDocumentVersions(ctx.supabase, setId, typeId))[0]
    : undefined;
  const reason = !doc?.section
    ? noRedraftReason("unmapped")
    : doc.section.mode !== "tailored"
      ? noRedraftReason("fixed")
      : !latest
        ? noRedraftReason("no-version")
        : null;
  return (
    <RegisterPage
      title={`Redraft: ${type.title}${doc?.section ? `, section ${doc.section.number} ${doc.section.heading}` : ""}`}
      canWrite={ctx.canWrite}
      back={{ href: backHref, label: `Finding ${row.reference}` }}
    >
      <p className="mt-3 leading-7" data-testid="redraft-intro">
        {REDRAFT_INTRO}
      </p>
      <section aria-labelledby="redraft-finding-heading" className="mt-4">
        <h2 id="redraft-finding-heading" className="text-lg font-medium">
          The finding, in your words
        </h2>
        <p
          className="border-rule mt-2 rounded-md border p-4 leading-7"
          data-testid="redraft-finding"
        >
          {row.finding}
        </p>
      </section>
      <p
        className="text-slate mt-4 text-sm leading-6"
        data-testid="redraft-what-is-sent"
      >
        {REDRAFT_WHAT_IS_SENT}
      </p>
      {reason ? (
        <p className="mt-4 leading-7" data-testid="redraft-reason">
          {reason}{" "}
          <Link href={backHref} className="underline underline-offset-4">
            Back to the finding
          </Link>
        </p>
      ) : !ctx.canWrite ? (
        <p className="mt-4 leading-7" data-testid="redraft-reason">
          The redraft needs the registers subscription.{" "}
          <Link href="/pricing" className="underline underline-offset-4">
            See the price
          </Link>
        </p>
      ) : (
        <RedraftPanel findingId={row.id} typeId={typeId} backHref={backHref} />
      )}
    </RegisterPage>
  );
}
