import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  FINDINGS_IMPORT_LABEL,
  FINDINGS_INTRO,
  standardOptions,
} from "@/lib/registers/findings";
import { RegisterPage, registerContext } from "../../_components/shell";
import { FindingsImportForm } from "./findings-import-form";

export const metadata: Metadata = {
  title: "Audit findings: add from your report",
};

/**
 * REQ-033 FR-1, FR-2, FR-7 (D-2930, D-2931, D-2936): the findings from an
 * auditor's report, pasted or uploaded, read in the request and never
 * stored, each one shown for the provider to put in their own words before
 * it is saved; a flagged candidate cannot be saved until its words change.
 */
export default async function Page() {
  const ctx = await registerContext("/registers/findings/import");
  if (!ctx.canWrite) redirect("/registers/findings");
  return (
    <RegisterPage
      title={FINDINGS_IMPORT_LABEL}
      intro={FINDINGS_INTRO}
      canWrite={ctx.canWrite}
      back={{ href: "/registers/findings", label: "Audit findings" }}
    >
      <FindingsImportForm standards={standardOptions()} />
    </RegisterPage>
  );
}
