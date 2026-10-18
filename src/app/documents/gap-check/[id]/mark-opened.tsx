"use client";
import { useEffect } from "react";
import { noteGapCheckOpenedAction } from "@/server/gap-check/actions";

/**
 * REQ-035 SR-4: records that someone other than the person who ran the
 * check opened its result, once the page has rendered. Shows nothing.
 */
export function MarkGapCheckOpened({ id }: { id: string }) {
  useEffect(() => {
    void noteGapCheckOpenedAction({ id }).catch(() => undefined);
  }, [id]);
  return null;
}
