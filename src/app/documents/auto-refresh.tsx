"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-reads the server data every few seconds while a set is being prepared (REQ-007 FR-5). */
export function AutoRefresh({ everyMs = 8000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(id);
  }, [router, everyMs]);
  return null;
}
