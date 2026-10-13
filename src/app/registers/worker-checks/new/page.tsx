import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterPage, registerContext } from "../../_components/shell";
import { WorkerCheckFormView } from "../../_components/worker-check-form";

export const metadata: Metadata = { title: "Add a worker check" };

export default async function NewWorkerCheckPage() {
  const ctx = await registerContext("/registers/worker-checks/new");
  if (!ctx.canWrite) redirect("/registers/worker-checks");
  return (
    <RegisterPage
      title="Add a worker check"
      intro="One row per worker per check. The worker is a code; keep the list of codes in your own records."
      canWrite={ctx.canWrite}
      back={{ href: "/registers/worker-checks", label: "Worker checks" }}
    >
      <WorkerCheckFormView />
    </RegisterPage>
  );
}
