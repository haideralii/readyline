"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { STALL_AFTER_MS } from "@/lib/payments/documents-state";
import { nudgeGenerationAction } from "@/server/generation/nudge";

/**
 * Re-reads the server data every few seconds while a set is being prepared
 * (REQ-007 FR-5) and, when the job has not moved for STALL_AFTER_MS, asks
 * the server to run it (batch 23 item 4, D-1005). `lastChangeAt` is the
 * job row's updated_at; a nudge is sent at most once per stall window.
 */
export function AutoRefresh({
  everyMs = 8000,
  lastChangeAt,
}: {
  everyMs?: number;
  lastChangeAt?: string | null;
}) {
  const router = useRouter();
  const nudgedFor = useRef<string | null>(null);
  useEffect(() => {
    const id = setInterval(() => {
      const stalled =
        lastChangeAt &&
        Date.now() - new Date(lastChangeAt).getTime() >= STALL_AFTER_MS;
      if (stalled && nudgedFor.current !== lastChangeAt) {
        nudgedFor.current = lastChangeAt;
        void nudgeGenerationAction().catch(() => undefined);
      }
      router.refresh();
    }, everyMs);
    return () => clearInterval(id);
  }, [router, everyMs, lastChangeAt]);
  return null;
}
