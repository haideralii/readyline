import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AUDIT_DAY_META,
  rowToValues,
  type AuditDaySlug,
} from "@/lib/registers/audit-day-forms";
import { onboardingItemsFor } from "@/lib/registers/onboarding-items";
import type {
  OnboardingKind,
  StaffMatrixRow,
} from "@/lib/registers/audit-day-types";
import { CLEARANCE_LABELS } from "@/lib/registers/labels";
import { FROM_THE_DATES_LINE } from "@/lib/registers/worker-state";
import {
  accountModuleIds,
  listWorkerStates,
  loadWorkerFile,
  ownerWorkerRef,
} from "@/server/registers/worker-onboarding";
import { WorkerItems } from "./worker-items";
import { ExceptionPanel } from "./exception-panel";
import { part4EndFor } from "@/lib/registers/state-facts";
import { AU_STATES } from "@/lib/registers/types";
import { latestReadySet } from "@/server/checklist/queries";
import {
  getAuditDayRow,
  listAuditDayRows,
  listOnboardingTicks,
  listRegisterTrail,
  seedCorporateRisks,
} from "@/server/registers/audit-day-queries";
import { loadQuestionnaire } from "@/server/path/state";
import { AuditDayForm } from "./audit-day-form";
import { OnboardingTicks } from "./onboarding-ticks";
import { RegisterList, StatusTag, type ListRow } from "./register-list";
import { RegisterTrail } from "./register-trail";
import { RegisterPage, registerContext } from "./shell";

/**
 * The three pages every audit-day register has (REQ-018 Session B;
 * D-1904): the list with its filters, the add form, and the row with its
 * facts, edit form and trail. The route files are one line each; the
 * register's meta supplies the words. The corporate risk register seeds
 * its nine starter rows on first open (FR-1).
 */
const REVIEWABLE = new Set<AuditDaySlug>([
  "corporate-risks",
  "participant-risks",
  "conflicts-of-interest",
]);

function todaySydney(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function AuditDayListPage({
  slug,
  saved,
}: {
  slug: AuditDaySlug;
  saved?: string;
}) {
  const meta = AUDIT_DAY_META[slug];
  const ctx = await registerContext(`/registers/${slug}`);
  if (slug === "corporate-risks" && ctx.canWrite) {
    const { answers, result } = await loadQuestionnaire();
    if (answers && result)
      await seedCorporateRisks(
        ctx.supabase,
        ctx.viewer.account.id,
        answers,
        result,
        todaySydney(),
      );
  }
  const rows = await listAuditDayRows(
    ctx.supabase,
    ctx.viewer.account.id,
    slug,
  );
  // REQ-024 A1 (FR-3, D-2411): the staff list shows each worker's derived state and the next thing to do.
  const workerStates =
    slug === "staff-matrix"
      ? await (async () => {
          const { result } = await loadQuestionnaire();
          const owner = await ownerWorkerRef(
            ctx.supabase,
            ctx.viewer.account.id,
            ctx.viewer.user.id,
          );
          return listWorkerStates(
            ctx.supabase,
            ctx.viewer.account.id,
            rows as unknown as StaffMatrixRow[],
            {
              moduleIds: await accountModuleIds(
                ctx.supabase,
                ctx.viewer.account.id,
                result,
              ),
              ownerRef: owner?.workerRef ?? null,
              today: todaySydney(),
            },
          );
        })()
      : null;
  const list: ListRow[] = rows.map((r) => {
    const derived = workerStates?.get(String(r.worker_ref));
    return {
      id: r.id,
      href: `/registers/${slug}/${r.id}`,
      title: meta.titleOf(r as never),
      detail: derived
        ? derived.next
          ? `Next: ${derived.next}`
          : meta.detailOf(r as never)
        : meta.detailOf(r as never),
      status: derived
        ? {
            key: derived.key,
            label: derived.label,
            tone:
              derived.key === "all-recorded"
                ? "moss"
                : derived.key === "ended"
                  ? "slate"
                  : "ochre",
          }
        : meta.statusOf(r as never),
    };
  });
  return (
    <RegisterPage
      title={meta.title}
      intro={meta.intro}
      canWrite={ctx.canWrite}
      addHref={`/registers/${slug}/new`}
      addLabel={meta.addLabel}
      // REQ-020 FR-8: the corporate risk register takes a spreadsheet.
      importHref={
        slug === "corporate-risks"
          ? "/registers/corporate-risks/import"
          : undefined
      }
      back={{ href: "/registers", label: "Registers" }}
    >
      {saved ? (
        <p
          role="status"
          className="text-moss mt-3 text-sm"
          data-testid="register-saved"
        >
          ✓ Saved.
        </p>
      ) : null}
      {slug === "staff-matrix" ? (
        <p
          className="text-slate mt-3 text-sm leading-6"
          data-testid="from-the-dates-line"
        >
          {FROM_THE_DATES_LINE}
        </p>
      ) : null}
      {slug === "corporate-risks" ? (
        // REQ-020 FR-7: the emergency and WHS risks point at the hazard register.
        <p className="mt-3 text-sm leading-6" data-testid="hazards-link-line">
          A risk in the emergency area or a work health and safety risk often
          starts as a hazard:{" "}
          <Link
            href="/registers/hazards"
            className="underline underline-offset-2"
          >
            open the hazard register
          </Link>
          .
        </p>
      ) : null}
      <RegisterList
        testId={`${slug}-list`}
        rows={list}
        filters={meta.filters}
        empty={meta.empty}
      />
    </RegisterPage>
  );
}

export async function AuditDayNewPage({
  slug,
  prefill,
}: {
  slug: AuditDaySlug;
  /** Query-string values to start the form with (the one-tap improvement row, FR-6). */
  prefill?: Record<string, string | undefined>;
}) {
  const meta = AUDIT_DAY_META[slug];
  const ctx = await registerContext(`/registers/${slug}/new`);
  if (!ctx.canWrite) redirect(`/registers/${slug}`);
  const allowed = new Set(meta.fields.map((f) => f.name));
  const initial = prefill
    ? Object.fromEntries(
        Object.entries(prefill)
          .filter(([k, v]) => allowed.has(k) && typeof v === "string")
          .map(([k, v]) => [k, (v as string).slice(0, 500)]),
      )
    : {};
  const blank = Object.fromEntries(
    meta.fields.map((f) => [f.name, f.kind === "checkbox" ? false : ""]),
  );
  return (
    <RegisterPage
      title={meta.addLabel}
      intro={meta.intro}
      canWrite={ctx.canWrite}
      back={{ href: `/registers/${slug}`, label: meta.title }}
    >
      <AuditDayForm
        slug={slug}
        initial={{ ...blank, ...initial }}
        cancelHref={`/registers/${slug}`}
      />
    </RegisterPage>
  );
}

export async function AuditDayDetailPage({
  slug,
  id,
}: {
  slug: AuditDaySlug;
  id: string;
}) {
  const meta = AUDIT_DAY_META[slug];
  const ctx = await registerContext(`/registers/${slug}/${id}`);
  const row = await getAuditDayRow(
    ctx.supabase,
    ctx.viewer.account.id,
    slug,
    id,
  );
  if (!row) notFound();
  const facts = meta.fields.map((f) => {
    const v = row[f.name];
    const label =
      f.kind === "select"
        ? (f.options?.find((o) => o.value === v)?.label ?? String(v ?? ""))
        : f.kind === "checkbox"
          ? v
            ? "Yes"
            : "No"
          : v === null || v === undefined || v === ""
            ? "Not set"
            : String(v);
    return [f.label, label] as [string, string];
  });
  const trail = meta.appendOnly
    ? []
    : await listRegisterTrail(
        ctx.supabase,
        ctx.viewer.account.id,
        meta.table,
        id,
      );
  const ticks =
    slug === "onboarding"
      ? await listOnboardingTicks(ctx.supabase, ctx.viewer.account.id, id)
      : [];
  // REQ-024 A1 (FR-2, FR-3): a worker's row and a worker's checklist both show the derived list and state.
  const workerRef =
    slug === "staff-matrix"
      ? String(row.worker_ref)
      : slug === "onboarding" && row.kind === "worker"
        ? String(row.subject_ref)
        : null;
  const file = workerRef
    ? await (async () => {
        const matrix =
          slug === "staff-matrix"
            ? (row as unknown as StaffMatrixRow)
            : ((
                await ctx.supabase
                  .from("staff_matrix")
                  .select("*")
                  .eq("account_id", ctx.viewer.account.id)
                  .eq("worker_ref", workerRef)
                  .maybeSingle()
              ).data as StaffMatrixRow | null);
        if (!matrix) return null;
        const { result } = await loadQuestionnaire();
        const owner = await ownerWorkerRef(
          ctx.supabase,
          ctx.viewer.account.id,
          ctx.viewer.user.id,
        );
        return loadWorkerFile(ctx.supabase, ctx.viewer.account.id, matrix, {
          moduleIds: await accountModuleIds(
            ctx.supabase,
            ctx.viewer.account.id,
            result,
          ),
          ownerRef: owner?.workerRef ?? null,
          today: todaySydney(),
          canWrite: ctx.canWrite,
        });
      })()
    : null;
  const workerTicks =
    file?.checklist && slug === "staff-matrix"
      ? await listOnboardingTicks(
          ctx.supabase,
          ctx.viewer.account.id,
          file.checklist.id,
        )
      : ticks;
  return (
    <RegisterPage
      title={meta.titleOf(row as never)}
      canWrite={ctx.canWrite}
      back={{ href: `/registers/${slug}`, label: meta.title }}
    >
      <p className="mt-3">
        <StatusTag status={meta.statusOf(row as never)} />
      </p>
      {slug === "corporate-risks" && row.starter ? (
        <p
          className="border-ochre mt-3 rounded-md border p-3 text-sm leading-6"
          data-testid="starter-note"
        >
          This row came from your questionnaire answers. Check it and change it
          so it says what you do.
        </p>
      ) : null}
      <dl
        className="mt-5 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2"
        data-testid="row-facts"
      >
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt className="text-slate">{k}</dt>
            <dd className="font-medium [overflow-wrap:anywhere]">{v}</dd>
          </div>
        ))}
      </dl>
      {file ? (
        <>
          <WorkerItems
            checklistId={file.checklist?.id ?? null}
            items={file.items}
            states={file.states}
            ticks={workerTicks}
            derived={file.derived}
            canWrite={ctx.canWrite}
            today={todaySydney()}
          />
          {file.exception && slug === "staff-matrix" ? (
            <ExceptionPanel
              workerRef={file.row.worker_ref}
              ownerRow={file.ownerRow}
              canWrite={ctx.canWrite}
              today={todaySydney()}
              gate={file.exception.gate}
              exception={file.exception.exception}
              history={file.exception.history}
              application={
                file.exception.application
                  ? {
                      id: file.exception.application.id,
                      application_number:
                        file.exception.application.application_number,
                      state: file.exception.application.state,
                      verified_in_database_on:
                        file.exception.application.verified_in_database_on,
                      decision_code:
                        file.exception.application.decision_code ?? null,
                    }
                  : null
              }
              plan={
                file.exception.plan
                  ? {
                      version: file.exception.plan.version,
                      adopted_on: file.exception.plan.adopted_on,
                    }
                  : null
              }
              setId={
                (await latestReadySet(ctx.supabase, ctx.viewer.account.id))
                  .setId
              }
              supervisorClearanceEndedOn={
                file.derived.supervisorClearanceEndedOn
              }
              part4Ends={Object.fromEntries(
                AU_STATES.map((s) => [s, part4EndFor(s)]),
              )}
            />
          ) : null}
        </>
      ) : slug === "onboarding" && row.kind === "worker" ? (
        <p
          className="border-ochre mt-6 rounded-md border p-3 text-sm leading-6"
          data-testid="no-matrix-row"
        >
          This worker has no row in the staff matrix yet. Add one with their
          code, role and states, and the list derives itself from it.{" "}
          <Link
            href="/registers/staff-matrix/new"
            className="underline underline-offset-2"
          >
            Add the worker
          </Link>
          .
        </p>
      ) : slug === "onboarding" ? (
        <OnboardingTicks
          checklistId={id}
          items={onboardingItemsFor(row.kind as OnboardingKind)}
          ticks={ticks}
          canWrite={ctx.canWrite}
          today={todaySydney()}
        />
      ) : null}
      {file && file.clearances.length > 0 ? (
        <section
          aria-labelledby="worker-clearances-heading"
          className="mt-6"
          data-testid="worker-clearances"
        >
          <h2 id="worker-clearances-heading" className="">
            Checks and training on the worker checks register
          </h2>
          <ul className="divide-rule mt-2 divide-y text-sm">
            {file.clearances.map((c) => (
              <li key={c.id} className="py-2 leading-6">
                <Link
                  href={`/registers/worker-checks/${c.id}`}
                  className="underline underline-offset-2"
                >
                  {CLEARANCE_LABELS[c.clearance_kind]}
                </Link>
                {c.issued_on
                  ? `: issued ${c.issued_on}`
                  : `: pending${c.application_number ? `, application ${c.application_number}` : ""}`}
                {c.expires_on ? `, expires ${c.expires_on}` : ""}
                {c.verified_in_database_on
                  ? `, checked in the database ${c.verified_in_database_on}`
                  : c.clearance_kind === "ndis-worker-screening"
                    ? ", not yet checked in the database"
                    : ""}
                .
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {file ? (
        <p className="mt-3 text-sm">
          <Link
            href={`/registers/worker-checks/new?worker=${encodeURIComponent(file.row.worker_ref)}`}
            className="underline underline-offset-2"
            data-testid="add-check-link"
          >
            Add a check or training for {file.row.worker_ref}
          </Link>
        </p>
      ) : null}
      {ctx.canWrite && !meta.appendOnly ? (
        <details className="mt-6" data-testid="row-edit">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium underline underline-offset-4">
            Change this {meta.singular}
          </summary>
          <AuditDayForm
            slug={slug}
            id={id}
            initial={rowToValues(meta.fields, row)}
            cancelHref={`/registers/${slug}/${id}`}
          />
        </details>
      ) : null}
      {meta.appendOnly ? (
        <p className="text-slate mt-6 text-sm">
          A decision is never edited. If it changes,{" "}
          <Link
            href={`/registers/${slug}/new`}
            className="underline underline-offset-2"
          >
            add a new decision
          </Link>
          .
        </p>
      ) : (
        <RegisterTrail
          slug={slug}
          rowId={id}
          events={trail}
          canWrite={ctx.canWrite}
          reviewable={REVIEWABLE.has(slug)}
        />
      )}
    </RegisterPage>
  );
}
