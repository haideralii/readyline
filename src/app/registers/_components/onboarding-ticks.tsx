"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OnboardingTickRow } from "@/lib/registers/audit-day-types";
import type { OnboardingItem } from "@/lib/registers/onboarding-items";
import { tickOnboardingItemAction } from "@/server/registers/audit-day-actions";
import { DateField, RefField } from "./inputs";

/**
 * The items of one onboarding checklist (REQ-018 FR-9): each line is an
 * instruction; a tick records the date and who ticked it and cannot be
 * undone by a member (append only). One "who" code and date serve every
 * tick on the page, asked for once.
 */
export function OnboardingTicks({
  checklistId,
  items,
  ticks,
  canWrite,
  today,
}: {
  checklistId: string;
  items: OnboardingItem[];
  ticks: OnboardingTickRow[];
  canWrite: boolean;
  today: string;
}) {
  const router = useRouter();
  const byItem = new Map(ticks.map((t) => [t.item_id, t]));
  const [who, setWho] = useState("");
  const [on, setOn] = useState(today);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const left = items.filter((i) => !byItem.has(i.id)).length;

  async function tick(itemId: string) {
    setPending(itemId);
    setErrors([]);
    try {
      const r = await tickOnboardingItemAction({
        checklist_id: checklistId,
        item_id: itemId,
        ticked_on: on,
        ticked_by_ref: who,
      });
      if (!r.ok) {
        setErrors([
          ...(r.fieldErrors?.ticked_by_ref ?? []),
          ...(r.fieldErrors?.ticked_on ?? []),
          r.message,
        ]);
        return;
      }
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <section
      aria-labelledby="ticks-heading"
      className="mt-6"
      data-testid="onboarding-ticks"
    >
      <h2 id="ticks-heading" className="text-lg font-semibold">
        {left === 0
          ? "Every item is ticked."
          : `${left} of ${items.length} items left`}
      </h2>
      {canWrite && left > 0 ? (
        <div className="border-rule mt-3 rounded-md border p-3">
          <RefField
            id="ticked-by"
            label="Who is ticking"
            hint="KP-1 or W-003"
            errors={errors}
            value={who}
            onChange={setWho}
            optional={false}
          />
          <DateField
            id="ticked-on"
            label="Date"
            errors={[]}
            value={on}
            onChange={setOn}
          />
        </div>
      ) : null}
      <ol className="divide-rule mt-3 divide-y">
        {items.map((item) => {
          const t = byItem.get(item.id);
          return (
            <li
              key={item.id}
              className="flex items-start gap-3 py-3 leading-7"
              data-testid={`onboarding-item-${item.id}`}
            >
              <span aria-hidden="true" className="w-5 shrink-0">
                {t ? "✓" : "○"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block">{item.text}</span>
                {t ? (
                  <span className="text-slate block text-sm">
                    Ticked {t.ticked_on} by {t.ticked_by_ref}.
                  </span>
                ) : canWrite ? (
                  <button
                    type="button"
                    className="btn-secondary mt-2 text-sm"
                    disabled={pending !== null}
                    aria-busy={pending === item.id || undefined}
                    onClick={() => tick(item.id)}
                    data-testid={`tick-${item.id}`}
                  >
                    {pending === item.id ? "Saving…" : "Tick: done"}
                  </button>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
