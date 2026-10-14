"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DateField } from "@/app/registers/_components/inputs";
import { recordDrillAction } from "@/server/registers/audit-day-actions";

/**
 * The last emergency drill (REQ-018 FR-10): one date on the audit-day
 * page; the reminder fires six months after it. A drill is evidence the
 * auditor asks for with the emergency and disaster plan.
 */
export function DrillForm({ last }: { last: string | null }) {
  const router = useRouter();
  const [on, setOn] = useState(last ?? "");
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setErrors([]);
    setSaved(false);
    try {
      const r = await recordDrillAction({ last_emergency_drill_on: on });
      if (!r.ok) {
        setErrors([
          ...(r.fieldErrors?.last_emergency_drill_on ?? []),
          r.message,
        ]);
        return;
      }
      setSaved(true);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="mt-3 print:hidden"
      data-testid="drill-form"
    >
      <DateField
        id="last_emergency_drill_on"
        label="Last emergency drill"
        help="We remind you when six months have passed."
        errors={errors}
        value={on}
        onChange={setOn}
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="btn-secondary"
          disabled={pending}
          aria-busy={pending || undefined}
          data-testid="drill-save"
        >
          {pending ? "Saving…" : "Save the drill date"}
        </button>
        {saved ? (
          <span role="status" className="text-moss text-sm">
            ✓ Saved.
          </span>
        ) : null}
      </div>
    </form>
  );
}
