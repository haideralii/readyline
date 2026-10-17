"use client";
/**
 * REQ-024 Session A3 (FR-6b; SR-8(b)): the export screen's form as the
 * browser runs it: a plain multipart post to the fill handlers (no server
 * action, no draft store), the checkbox showing the fields, and the clear,
 * on leaving the page and ten minutes after the last keystroke. Nothing the
 * owner types reaches any state that outlives the page.
 */
import { useEffect, useRef, useState } from "react";
import { FILL_CLEAR_MS, FILL_PATHS } from "@/lib/registers/fill";
import { FillFormFields, type FillFormValues } from "./fill-form";

export function FillFormClient(props: {
  codes: readonly string[];
  pastCodes: readonly string[];
  supervisorRefs: readonly string[];
  assessorDefault: string;
  state: FillFormValues;
}) {
  const [fill, setFill] = useState(props.state.fill);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const el = form.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const clear = () => {
      el.reset();
      setFill(false);
    };
    const arm = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(clear, FILL_CLEAR_MS);
    };
    el.addEventListener("input", arm);
    window.addEventListener("pagehide", clear);
    return () => {
      if (timer) clearTimeout(timer);
      el.removeEventListener("input", arm);
      window.removeEventListener("pagehide", clear);
    };
  }, []);

  return (
    <form
      ref={form}
      method="post"
      action={FILL_PATHS["screening-list"]}
      encType="multipart/form-data"
      autoComplete="off"
      noValidate={false}
      data-testid="fill-form-element"
    >
      <FillFormFields
        {...props}
        state={{ ...props.state, fill }}
        onFillChange={setFill}
      />
    </form>
  );
}
