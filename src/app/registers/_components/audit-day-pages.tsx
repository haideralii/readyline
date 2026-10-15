import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AUDIT_DAY_META,
  rowToValues,
  type AuditDaySlug,
} from "@/lib/registers/audit-day-forms";
import { onboardingItemsFor } from "@/lib/registers/onboarding-items";
import type { OnboardingKind } from "@/lib/registers/audit-day-types";
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
  const list: ListRow[] = rows.map((r) => ({
    id: r.id,
    href: `/registers/${slug}/${r.id}`,
    title: meta.titleOf(r as never),
    detail: meta.detailOf(r as never),
    status: meta.statusOf(r as never),
  }));
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
            <dt className="text-zinc-600 dark:text-zinc-400">{k}</dt>
            <dd className="font-medium [overflow-wrap:anywhere]">{v}</dd>
          </div>
        ))}
      </dl>
      {slug === "onboarding" ? (
        <OnboardingTicks
          checklistId={id}
          items={onboardingItemsFor(row.kind as OnboardingKind)}
          ticks={ticks}
          canWrite={ctx.canWrite}
          today={todaySydney()}
        />
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
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
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
