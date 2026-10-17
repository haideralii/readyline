import { redirect } from "next/navigation";
import {
  IMPORT_SLUGS,
  canUndoImport,
  type ImportRegister,
} from "@/lib/registers/import";
import { ImportForm } from "./import-form";
import { RegisterPage, registerContext } from "./shell";

const TITLES: Record<ImportRegister, string> = {
  incidents: "Incidents",
  complaints: "Complaints",
  worker_clearances: "Worker checks",
  corporate_risks: "Corporate risks",
  commission_changes: "Changes we told the Commission",
};

/** The one import page every importable register's route renders (REQ-020 FR-8). */
export async function ImportPage({ register }: { register: ImportRegister }) {
  const slug = IMPORT_SLUGS[register];
  const ctx = await registerContext(`/registers/${slug}/import`);
  if (!ctx.canWrite) redirect(`/registers/${slug}`);
  const r = await ctx.supabase
    .from("imports")
    .select("id, created_at, rows_imported, rows_total, undone_at")
    .eq("account_id", ctx.viewer.account.id)
    .eq("register", register)
    .is("undone_at", null)
    .order("created_at", { ascending: false })
    .limit(5);
  const now = new Date();
  const recent = (
    (r.data as
      | {
          id: string;
          created_at: string;
          rows_imported: number;
          rows_total: number;
        }[]
      | null) ?? []
  ).map((i) => ({
    id: i.id,
    createdAt: new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Sydney",
      day: "numeric",
      month: "long",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(i.created_at)),
    imported: i.rows_imported,
    total: i.rows_total,
    canUndo: canUndoImport(i.created_at, now),
  }));
  return (
    <RegisterPage
      title={`Import into ${TITLES[register].toLowerCase()}`}
      intro="A spreadsheet with our column names becomes rows in this register. Rows that do not pass are listed with the reason and left out; the rest are imported as ordinary entries, each marked as imported in its trail."
      canWrite={ctx.canWrite}
      back={{ href: `/registers/${slug}`, label: TITLES[register] }}
    >
      <ImportForm
        register={register}
        slug={slug}
        title={TITLES[register].toLowerCase()}
        recent={recent}
      />
    </RegisterPage>
  );
}
