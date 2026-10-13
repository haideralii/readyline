import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { IncidentFormView } from "../../_components/incident-form";
import { RegisterPage, registerContext } from "../../_components/shell";

export const metadata: Metadata = { title: "Add an incident" };

/** One thing per page (REQ-015): the add form on its own page. Without a subscription the list is where you land. */
export default async function NewIncidentPage() {
  const ctx = await registerContext("/registers/incidents/new");
  if (!ctx.canWrite) redirect("/registers/incidents");
  return (
    <RegisterPage
      title="Add an incident"
      canWrite={ctx.canWrite}
      back={{ href: "/registers/incidents", label: "Incidents" }}
    >
      <IncidentFormView />
    </RegisterPage>
  );
}
