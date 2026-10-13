import Link from "next/link";
import { getViewer } from "@/server/accounts/queries";
import { nextStepFor } from "@/server/path/state";
import { createSupabaseServerClient } from "@/server/supabase/server";

/**
 * "Your next step" on every signed-in page (REQ-017 FR-1, D-1701): one
 * sentence and one button from the account's state, never two things.
 * Nothing renders signed out or before the account exists. Server
 * component, so the state is read once per page with the owner's session.
 */
export async function NextStepStrip() {
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted) return null;
  const supabase = await createSupabaseServerClient();
  const step = await nextStepFor(supabase, viewer);
  if (!step) return null;
  return (
    <aside
      aria-label="Your next step"
      className="border-ochre/40 bg-mist border-b"
      data-testid="next-step"
      data-step={step.id}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-sm sm:px-6">
        <p className="min-w-0 flex-1 leading-6">
          <strong className="font-semibold">Your next step.</strong>{" "}
          {step.sentence}
        </p>
        <Link
          href={step.button.href}
          className="btn-primary min-h-11 whitespace-nowrap"
          data-testid="next-step-button"
        >
          {step.button.label}
        </Link>
      </div>
    </aside>
  );
}
