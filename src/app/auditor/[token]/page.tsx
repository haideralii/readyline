import { PageShell } from "@/components/page-shell";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { DataTable } from "@/components/data-table";
import { GENERAL_INFORMATION_STATEMENT } from "@/lib/brand";
import {
  AUDITOR_OPEN_LIMITED_LINE,
  auditorBanner,
} from "@/lib/registers/auditor-link";
import { packIntro } from "@/lib/registers/audit-pack";
import { checkAuditorOpenAllowed } from "@/server/auth/rate-limit";
import {
  DOCUMENT_CONTROL_COLUMNS,
  collectAuditView,
} from "@/server/registers/audit-pack";
import {
  recordAuditorOpen,
  resolveAuditorToken,
} from "@/server/registers/auditor-links";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { SupabaseEnvError } from "@/server/supabase/env";
import type { SupabaseClient } from "@supabase/supabase-js";

export const metadata: Metadata = {
  title: "Shared audit view",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * The signed-out read-only view behind an auditor link (REQ-020 FR-2, FR-3,
 * FR-10, SR-1): the banner, the records table first, the pack download, the
 * document control register and each register's rows with codes only. A
 * revoked, expired or unknown token is a plain 404; every open is recorded.
 * No account id, email or user id reaches this HTML; nothing here names or
 * recommends an auditor, and Readyline sends this link to no one.
 */
const cell = (v: unknown): string =>
  v === null || v === undefined
    ? ""
    : typeof v === "object"
      ? JSON.stringify(v)
      : String(v);

export default async function AuditorPage({
  params,
}: PageProps<"/auditor/[token]">) {
  const { token } = await params;
  let admin: SupabaseClient;
  try {
    admin = createSupabaseAdminClient();
  } catch (e) {
    // No Supabase in this environment (the public CI job): nothing to show.
    if (e instanceof SupabaseEnvError) notFound();
    throw e;
  }
  const link = await resolveAuditorToken(admin, token);
  if (!link) notFound();
  const h = await headers();
  const address = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  // Retro review of REQ-020, finding 21: every open writes a row, so one
  // address gets sixty opens of this link an hour. A page cannot answer 429;
  // the plain message stands in, and nothing is written or shown.
  if (!(await checkAuditorOpenAllowed(link.linkId, address)))
    return (
      <PageShell kind="reading">
        <h1 className="">Too many opens</h1>
        <p className="mt-3 leading-7" data-testid="auditor-limited">
          {AUDITOR_OPEN_LIMITED_LINE}
        </p>
      </PageShell>
    );
  await recordAuditorOpen(admin, link, address, "opened");
  const view = await collectAuditView(admin, link.accountId);
  const date = new Date().toISOString().slice(0, 10);
  return (
    <PageShell kind="reading">
      <p
        role="status"
        className="border-rule rounded-md border p-3 text-sm leading-6"
        data-testid="auditor-banner"
      >
        {auditorBanner(link.tradingName, link.expiresAt)}
      </p>
      <h1 className="mt-6">Audit view: {link.tradingName}</h1>
      <p className="mt-3 leading-7">{packIntro(link.tradingName, date)}</p>
      <p className="mt-4">
        <a
          href={`/auditor/${token}/audit-pack.zip`}
          className="btn-primary"
          data-testid="auditor-pack-link"
        >
          Download the audit pack
        </a>
      </p>

      <section
        aria-labelledby="records-heading"
        className="mt-10"
        data-testid="auditor-records"
      >
        <h2 id="records-heading" className="">
          The records, and the state of each
        </h2>
        <DataTable
          label="Records"
          columns={["Record", "Rows", "Last entry", "State"]}
          rows={view.lines.map((l) => [
            l.name,
            String(l.rows),
            l.lastEntry ?? "none",
            l.state,
          ])}
        />
      </section>

      <section
        aria-labelledby="dc-heading"
        className="mt-10"
        data-testid="auditor-document-control"
      >
        <h2 id="dc-heading" className="">
          Document control register
        </h2>
        <DataTable
          label="Document control register"
          columns={[...DOCUMENT_CONTROL_COLUMNS]}
          rows={view.documentControl.map((r) =>
            DOCUMENT_CONTROL_COLUMNS.map((c) => cell(r[c])),
          )}
        />
      </section>

      {view.tables.map((t) => (
        <section
          key={t.id}
          aria-labelledby={`reg-${t.id}`}
          className="mt-10"
          data-testid={`auditor-register-${t.id}`}
        >
          <h2 id={`reg-${t.id}`} className="">
            {t.title}
          </h2>
          {t.rows.length ? (
            <DataTable
              label={t.title}
              columns={[...t.columns]}
              rows={t.rows.map((r) => t.columns.map((c) => cell(r[c])))}
            />
          ) : (
            <p className="text-slate mt-2 text-sm">Nothing recorded yet.</p>
          )}
        </section>
      ))}

      <p className="text-slate mt-10 text-sm">
        {GENERAL_INFORMATION_STATEMENT}
      </p>
    </PageShell>
  );
}
