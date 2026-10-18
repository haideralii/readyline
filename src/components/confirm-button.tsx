"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * A destructive action asks first (REQ-015 FR-15): the first tap replaces
 * the button with a one-line question and two choices, "Keep" (focused) and
 * the confirming button. `submit` makes the confirming button a form submit
 * so a server-action form (sign out everywhere) works without JavaScript
 * state of its own; otherwise `onConfirm` runs. "Keep" puts focus back on
 * the button that asked (live QA of b340ee3, D2: it had landed on the body,
 * so the next Tab started from the skip link).
 */
export function ConfirmButton({
  label,
  question,
  confirmLabel,
  onConfirm,
  submit = false,
  className = "btn-secondary",
  confirmClassName = "btn-primary",
  testId,
}: {
  label: ReactNode;
  question: string;
  confirmLabel: string;
  onConfirm?: () => void;
  submit?: boolean;
  className?: string;
  confirmClassName?: string;
  testId?: string;
}) {
  const [asking, setAsking] = useState(false);
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  useEffect(() => {
    if (!asking && returnFocus.current) {
      returnFocus.current = false;
      buttonRef.current?.focus();
    }
  }, [asking]);
  if (!asking)
    return (
      <button
        ref={buttonRef}
        type="button"
        className={className}
        onClick={() => setAsking(true)}
        data-testid={testId}
      >
        {label}
      </button>
    );
  return (
    <div
      role="group"
      aria-labelledby={id}
      className="border-rule rounded-md border p-3"
      data-testid={testId ? `${testId}-confirm` : undefined}
    >
      <p id={id} className="text-sm leading-6">
        {question}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            returnFocus.current = true;
            setAsking(false);
          }}
          autoFocus
        >
          Keep
        </button>
        <button
          type={submit ? "submit" : "button"}
          className={confirmClassName}
          onClick={submit ? undefined : onConfirm}
          data-testid={testId ? `${testId}-yes` : undefined}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
