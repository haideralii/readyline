"use client";
import { useEffect } from "react";
import { markWhatChangedReadAction } from "@/server/path/what-changed-actions";

/**
 * REQ-031 FR-5 (D-2890): records the owner's reading once the page has
 * rendered. Sets no state and shows nothing; the renewal step and the
 * audit-day link read the column on their next render.
 */
export function MarkWhatChangedRead() {
  useEffect(() => {
    void markWhatChangedReadAction().catch(() => undefined);
  }, []);
  return null;
}
