import { PageShell } from "@/components/page-shell";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/server/admin/access";
import { MfaForm } from "./mfa-form";

export const metadata: Metadata = {
  title: "Admin: authenticator",
  robots: { index: false, follow: false },
};

export default async function AdminMfaPage() {
  const ctx = await requireAdmin({ mfa: false });
  if (ctx.access.kind === "ok") redirect("/admin");
  const mode =
    ctx.access.kind === "mfa-verify"
      ? { kind: "verify" as const, factorId: ctx.access.factorId }
      : { kind: "enrol" as const };
  return (
    <PageShell kind="form">
      <h1 className="text-3xl font-semibold tracking-tight">
        Authenticator check
      </h1>
      <p className="text-ink mt-3 leading-7">
        {mode.kind === "enrol"
          ? "Admin pages need a second factor. Scan the code with an authenticator app, then enter the 6-digit code it shows."
          : "Enter the current 6-digit code from your authenticator app."}
      </p>
      <MfaForm mode={mode} />
    </PageShell>
  );
}
