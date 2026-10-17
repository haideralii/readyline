/**
 * REQ-024 Session A3 (FR-6b; SR-8(i); findings 31, 92, 124, 134, 161): the
 * printable one-paragraph notice an owner hands a worker who never signs
 * in. Fixed text only, no worker code and no typed value; it carries the
 * privacy policy's address and the date of the version that applied, so a
 * worker handed it a year later finds that version.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { loadLegalPage } from "@/lib/legal/pages";
import { EXPORT_SCREEN_PATH, FILL_COPY } from "@/lib/registers/fill";
import { PageShell } from "@/components/page-shell";
import { registerContext } from "../../../_components/shell";

export const metadata: Metadata = {
  title: "Notice for a worker: your details and the worker list",
};
export const dynamic = "force-dynamic";

export default async function Page() {
  await registerContext(`${EXPORT_SCREEN_PATH}/notice`);
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const privacy = loadLegalPage("privacy");
  const policyUrl = `${site}/legal/privacy`;
  return (
    <PageShell kind="reading">
      <p className="text-sm print:hidden">
        <Link
          href={EXPORT_SCREEN_PATH}
          className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
        >
          ‹ Worker files and the two Rules lists
        </Link>
      </p>
      <h1 className="">
        Notice for a worker: your details and the worker list
      </h1>
      <p className="text-slate mt-3 text-sm leading-6 print:hidden">
        Print this page or hand it over as it is. It names no one and carries
        nothing you typed; it tells the worker who holds their details and where{" "}
        {BRAND}&apos;s privacy policy is.
      </p>
      <p className="mt-6 leading-7" data-testid="worker-notice">
        {FILL_COPY.notice(policyUrl, privacy.updated)}
      </p>
      <p
        className="text-slate mt-6 text-sm leading-6"
        data-testid="worker-notice-meta"
      >
        Privacy policy: {policyUrl}, the version dated {privacy.updated}.
      </p>
    </PageShell>
  );
}
