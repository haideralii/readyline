import { PageShell } from "@/components/page-shell";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { DataTable } from "@/components/data-table";
import { PeriodSelector } from "@/components/period-selector";
import { GENERAL_INFORMATION_STATEMENT } from "@/lib/brand";
import {
  AUDITOR_OPEN_LIMITED_LINE,
  auditorBanner,
} from "@/lib/registers/auditor-link";
import { AUDITOR_RECIPIENTS_LINE, packIntro } from "@/lib/registers/audit-pack";
import {
  PERIOD_COLUMNS,
  PERIOD_COUNTS_LINE,
  parsePeriodParams,
  periodContextFrom,
  periodQuery,
  periodShownLine,
  periodUndatedLine,
  resolvePeriod,
  undatedCount,
  type PeriodRegister,
  type RawPeriodParams,
} from "@/lib/registers/period";
import { checkAuditorOpenAllowed } from "@/server/auth/rate-limit";
import {
  DOCUMENT_CONTROL_COLUMNS,
  collectAuditView,
} from "@/server/registers/audit-pack";
import {
  recordAuditorOpen,
  resolveAuditorToken,
} from "@/server/registers/auditor-links";
import { currentPeriod } from "@/server/registers/registration-queries";
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
 * REQ-023 FR-5, SR-3: the period selector filters the four REQ-009
 * registers; the view defaults to the registration period (D-2305), a
 * malformed period is refused at the proxy, and the open's audit line
 * carries the period as `from` and `to`.
 */
/** The view's table ids for the four period-filtered registers and their date columns. */
const PERIOD_TABLES: Record<string, PeriodRegister> = {
  incidents: "incidents",
  complaints: "complaints",
  "worker-checks": "worker_clearances",
  "policy-reviews": "policy_reviews",
};

function undatedLineFor(
  tableId: string,
  rows: readonly Record<string, unknown>[],
): string | null {
  const register = PERIOD_TABLES[tableId];
  if (!register) return null;
  return periodUndatedLine(undatedCount(rows, PERIOD_COLUMNS[register]));
}

const cell = (v: unknown): string =>
  v === null || v === undefined
    ? ""
    : typeof v === "object"
      ? JSON.stringify(v)
      : String(v);

export default async function AuditorPage({
  params,
  searchParams,
}: PageProps<"/auditor/[token]">) {
  const { token } = await params;
  const raw = (await searchParams) as RawPeriodParams;
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
  // The proxy refused a malformed period already; parsed again here so no
  // value reaches a query unparsed (SR-3), with the page's default otherwise.
  const parsed = parsePeriodParams(raw);
  const ctx = periodContextFrom(await currentPeriod(admin, link.accountId));
  const { period, unavailable } = resolvePeriod(
    parsed.ok ? parsed.selection : null,
    ctx,
    "period",
  );
  await recordAuditorOpen(admin, link, address, "opened", period);
  const view = await collectAuditView(admin, link.accountId, period);
  const date = new Date().toISOString().slice(0, 10);
  const basePath = `/auditor/${token}`;
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
      {/* REQ-024 SR-1 (findings 31, 37, 165): the recipients line, both numbers named, no name. */}
      <p
        className="text-slate mt-2 text-sm leading-6"
        data-testid="auditor-recipients"
      >
        {AUDITOR_RECIPIENTS_LINE}
      </p>
      <p className="mt-4">
        <a
          href={`${basePath}/audit-pack.zip${periodQuery(period, { explicitAll: true })}`}
          className="btn-primary"
          data-testid="auditor-pack-link"
        >
          Download the audit pack
        </a>
      </p>
      {/* REQ-023 FR-5: the period the four registers below and the pack cover. */}
      <p className="mt-4 text-sm" data-testid="auditor-period-line">
        {periodShownLine(period)}
        {period.kind === "all" ? null : (
          <span className="text-slate block">{PERIOD_COUNTS_LINE}</span>
        )}
      </p>
      {/* #99 run 2 (PO 02:20): one test id names one thing; the page's "Period shown" line keeps `auditor-period-line`,
        the selector's own line is `auditor-period-selector-line`. */}
      <PeriodSelector
        basePath={basePath}
        period={period}
        ctx={ctx}
        unavailable={unavailable}
        fallback="period"
        testId="auditor-period-selector"
      />

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
          {/* D-2318 A: how many rows of this register have no date in the period's column. */}
          {period.kind !== "all" && undatedLineFor(t.id, t.rows) ? (
            <p
              className="text-slate mt-1 text-sm leading-6"
              data-testid="auditor-period-count"
            >
              {undatedLineFor(t.id, t.rows)}
            </p>
          ) : null}
          {t.rows.length ? (
            <DataTable
              label={t.title}
              columns={[...t.columns]}
              rows={t.rows.map((r) => t.columns.map((c) => cell(r[c])))}
            />
          ) : (
            <p className="text-slate mt-2 text-sm">
              {period.kind === "all"
                ? "Nothing recorded yet."
                : "Nothing recorded in this period."}
            </p>
          )}
        </section>
      ))}

      <p className="text-slate mt-10 text-sm">
        {GENERAL_INFORMATION_STATEMENT}
      </p>
    </PageShell>
  );
}
