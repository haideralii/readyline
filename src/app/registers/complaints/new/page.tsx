import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ComplaintFormView } from "../../_components/complaint-form";
import { RegisterPage, registerContext } from "../../_components/shell";

export const metadata: Metadata = { title: "Add a complaint" };

export default async function NewComplaintPage() {
  const ctx = await registerContext("/registers/complaints/new");
  if (!ctx.canWrite) redirect("/registers/complaints");
  return (
    <RegisterPage
      title="Add a complaint"
      canWrite={ctx.canWrite}
      back={{ href: "/registers/complaints", label: "Complaints" }}
    >
      <ComplaintFormView />
    </RegisterPage>
  );
}
