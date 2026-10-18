import Link from "next/link";
import { FindingActions } from "../findings/finding-actions";
import { FindingAnswers } from "../findings/finding-answers";
import { notFound, redirect } from "next/navigation";
import {
  AUDIT_DAY_META,
  rowToValues,
  type AuditDaySlug,
} from "@/lib/registers/audit-day-forms";
import { onboardingItemsFor } from "@/lib/registers/onboarding-items";
import {
  cellsFor,
  linkNameFor,
  tableColumns,
} from "@/lib/registers/table-columns";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  FindingRow,
  OnboardingKind,
  StaffMatrixRow,
  OnboardingTickRow,
} from "@/lib/registers/audit-day-types";
import { CLEARANCE_LABELS } from "@/lib/registers/labels";
import { FROM_THE_DATES_LINE } from "@/lib/registers/worker-state";
import {
  accountModuleIds,
  listWorkerStates,
  loadWorkerFile,
  ownerWorkerRef,
} from "@/server/registers/worker-onboarding";
import { SupervisionPanel } from "./supervision-panel";
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
  // REQ-024 Session C (FR-12): an ended worker sits under "Past workers", off the current list and its filters.
  const pastIds = new Set(
    slug === "staff-matrix"
      ? rows.filter((r) => r.ended_on).map((r) => r.id as string)
      : [],
  );
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
      cells: cellsFor(meta.columns, r as never),
      name: linkNameFor(slug, r) ?? undefined,
    };
  });
  return (
    <RegisterPage
      title={meta.title}
      intro={meta.intro}
      canWrite={ctx.canWrite}
      addHref={`/registers/${slug}/new`}
      addLabel={meta.addLabel}
      // REQ-024 FR-6b: the worker files and the two Rules lists, with the one-time fill.
      exportHref={
        slug === "staff-matrix" ? "/registers/staff-matrix/export" : undefined
      }
      exportLabel="Worker files and the two Rules lists"
      // REQ-020 FR-8: the corporate risk register takes a spreadsheet; REQ-024 FR-13: so does the staff matrix.
      importHref={
        // REQ-033 FR-1: the findings register takes a report, pasted or as a file.
        slug === "corporate-risks" ||
        slug === "staff-matrix" ||
        slug === "findings"
          ? `/registers/${slug}/import`
          : undefined
      }
      back={{ href: "/registers", label: "Registers" }}
      count={rows.length}
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
        rows={
          slug === "staff-matrix"
            ? list.filter((r) => !pastIds.has(r.id))
            : list
        }
        filters={
          slug === "staff-matrix"
            ? meta.filters.filter((f) => f.key !== "ended")
            : meta.filters
        }
        empty={meta.empty}
        columns={tableColumns(meta.columns)}
        emptyAction={
          ctx.canWrite
            ? { href: `/registers/${slug}/new`, label: meta.addLabel }
            : undefined
        }
        importHref={
          ctx.canWrite &&
          (slug === "corporate-risks" ||
            slug === "staff-matrix" ||
            slug === "findings")
            ? `/registers/${slug}/import`
            : undefined
        }
      />
      {pastIds.size > 0 ? (
        <section
          className="mt-10"
          aria-labelledby="past-workers-heading"
          data-testid="staff-matrix-past"
        >
          <h2 id="past-workers-heading" className="text-lg font-semibold">
            Past workers
          </h2>
          <p className="text-slate mt-1 text-sm leading-6">
            Workers who have ended. Their rows, files and dates stay for seven
            years and they remain on the screening list export with their end
            date; their sign-in, if they had one, ended with them.
          </p>
          <RegisterList
            testId="staff-matrix-past-list"
            rows={list.filter((r) => pastIds.has(r.id))}
            filters={[]}
            empty=""
            columns={tableColumns(meta.columns)}
          />
        </section>
      ) : null}
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
  // REQ-024 FR-8 (D-2444): the trail's actor is actor_user_id and its role comes from memberships.
  async function actorRolesFor(
    supabase: SupabaseClient,
    accountId: string,
    rows: OnboardingTickRow[],
  ): Promise<Record<string, string>> {
    const ids = [
      ...new Set(rows.map((r) => r.actor_user_id).filter(Boolean)),
    ] as string[];
    if (!ids.length) return {};
    const r = await supabase
      .from("memberships")
      .select("user_id, role")
      .eq("account_id", accountId)
      .in("user_id", ids);
    return Object.fromEntries(
      ((r.data as { user_id: string; role: string }[] | null) ?? []).map(
        (m) => [m.user_id, m.role],
      ),
    );
  }
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
      {/* REQ-023 FR-10: the Rule's words for the row's type, where the meta gives them. */}
      {meta.noteOf?.(row as never) ? (
        <p className="text-ink mt-3 text-sm leading-6" data-testid="row-note">
          {meta.noteOf(row as never)}
        </p>
      ) : null}
      {/* REQ-033 FR-4 (D-2933): where the pack answers the finding, with links into the newest set. */}
      {slug === "findings" ? (
        <FindingAnswers
          row={row as unknown as FindingRow}
          supabase={ctx.supabase}
          accountId={ctx.viewer.account.id}
          canWrite={ctx.canWrite}
        />
      ) : null}
      {/* REQ-033 FR-5 (D-2935): the provider's record of addressing it and of the auditor's verification. */}
      {slug === "findings" && ctx.canWrite ? (
        <FindingActions row={row as unknown as FindingRow} />
      ) : null}
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
            actorRoles={await actorRolesFor(
              ctx.supabase,
              ctx.viewer.account.id,
              workerTicks,
            )}
            derived={file.derived}
            canWrite={ctx.canWrite}
            today={todaySydney()}
          />
          {slug === "staff-matrix" ? (
            // REQ-024 Session C (FR-11): the supervision history and its one form, on the staff row alone.
            <SupervisionPanel
              workerRef={file.row.worker_ref}
              entries={file.supervision}
              lastSupervisionOn={file.row.last_supervision_on}
              canWrite={ctx.canWrite}
              today={todaySydney()}
              ownerRef={
                (
                  await ownerWorkerRef(
                    ctx.supabase,
                    ctx.viewer.account.id,
                    ctx.viewer.user.id,
                  )
                )?.workerRef ?? null
              }
            />
          ) : null}
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
