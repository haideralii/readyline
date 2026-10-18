"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { ANSWERS_VERSION } from "@/lib/questionnaire/steps";
import {
  sendResultEmailAction,
  type SendResultEmailResponse,
} from "@/server/path/result-email-actions";
import { useQuestionnaire } from "../questionnaire-provider";
import {
  RESULT_EMAIL_BUTTON,
  RESULT_EMAIL_BUSY,
  RESULT_EMAIL_LABEL,
  RESULT_EMAIL_NOT_SENT,
  RESULT_EMAIL_PRIVACY_LINE,
  RESULT_EMAIL_PRIVACY_LINK,
} from "./result-copy";

/**
 * "Email me my result" (REQ-031 FR-1; D-2891): one label, one email field
 * (prefilled for a signed-in owner), the privacy line with its link, one
 * secondary button (the card's primary stays the page's one primary,
 * REQ-017 FR-5), and the answer in words. Signed out, the answers travel
 * with the address; signed in, the server reads its own draft.
 */
const INPUT =
  "border-line bg-surface text-ink block min-h-12 w-full rounded-md border px-3 py-2 text-base shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2";

export function ResultEmailForm({ prefill }: { prefill: string | null }) {
  const { answers, mode } = useQuestionnaire();
  const [email, setEmail] = useState(prefill ?? "");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<SendResultEmailResponse | null>(null);
  const inFlight = useRef(false);

  async function send() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setReply(null);
    try {
      const r = await sendResultEmailAction({
        email,
        ...(mode === "server"
          ? {}
          : { answers: { answersVersion: ANSWERS_VERSION, ...answers } }),
      });
      setReply(r);
    } catch {
      setReply({ ok: false, message: RESULT_EMAIL_NOT_SENT });
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  return (
    <form
      className="border-line mt-4 rounded-md border p-4 print:hidden"
      data-testid="result-email-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <label htmlFor="result-email" className="block text-base font-medium">
        {RESULT_EMAIL_LABEL}
      </label>
      <input
        id="result-email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        maxLength={254}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-describedby="result-email-privacy"
        className={`${INPUT} mt-2`}
        data-testid="result-email"
      />
      <p
        id="result-email-privacy"
        className="text-slate mt-2 text-sm leading-6"
        data-testid="result-email-privacy"
      >
        {RESULT_EMAIL_PRIVACY_LINE}{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          {RESULT_EMAIL_PRIVACY_LINK}
        </Link>
        .
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="btn-secondary"
          data-testid="result-email-send"
        >
          {busy ? RESULT_EMAIL_BUSY : RESULT_EMAIL_BUTTON}
        </button>
        {reply ? (
          <p
            role={reply.ok ? "status" : "alert"}
            className="text-sm leading-6"
            data-testid="result-email-message"
          >
            {reply.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
