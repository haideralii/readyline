import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BRAND } from "@/lib/brand";
import { getViewer } from "@/server/accounts/queries";
import {
  DISABLED_MESSAGE,
  isGenerationEnabled,
} from "@/server/generation/policy";
import { listVersionSets } from "@/server/generation/queries";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { GenerateButton } from "./generate-button";

export const metadata: Metadata = { title: "Your documents" };

export default async function DocumentsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=%2Fdocuments");
  if (viewer.deleted) redirect("/account/deleted");
  if (!viewer.account) redirect("/account/setup");
  const enabled = isGenerationEnabled();
  const supabase = await createSupabaseServerClient();
  const sets = enabled
    ? await listVersionSets(supabase, viewer.account.id)
    : [];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-semibold tracking-tight">Your documents</h1>
      <p className="mt-3 leading-7 text-zinc-700 dark:text-zinc-300">
        {BRAND} drafts your policy and procedure set and a Practice Standards
        self-assessment from your questionnaire answers. Every document is a
        first draft for your review; sections we could not draft are marked for
        you to complete.
      </p>

      {!enabled ? (
        <p
          role="status"
          data-testid="generation-disabled"
          className="mt-6 rounded-md border border-zinc-300 bg-zinc-50 p-4 leading-7 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {DISABLED_MESSAGE}{" "}
          <Link href="/start/result" className="underline underline-offset-2">
            See your result
          </Link>
          .
        </p>
      ) : (
        <>
          <section aria-labelledby="generate-heading" className="mt-8">
            <h2 id="generate-heading" className="text-xl font-semibold">
              Generate a new set
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
              Uses your current questionnaire answers. Each account can generate
              a few sets a day; the limit resets at midnight Sydney time.
            </p>
            <GenerateButton />
          </section>

          <section aria-labelledby="sets-heading" className="mt-10">
            <h2 id="sets-heading" className="text-xl font-semibold">
              Document sets
            </h2>
            {sets.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                No sets yet.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
                {sets.map((s) => (
                  <li key={s.id} className="py-3">
                    <Link
                      href={`/documents/${s.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      Set generated{" "}
                      {new Date(s.created_at).toLocaleString("en-AU", {
                        timeZone: "Australia/Sydney",
                      })}
                    </Link>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {s.status === "ready"
                        ? `${s.document_count} documents; ${s.fallback_section_count} section${s.fallback_section_count === 1 ? "" : "s"} to review`
                        : s.status === "generating"
                          ? "Generating…"
                          : "Failed; try again"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
