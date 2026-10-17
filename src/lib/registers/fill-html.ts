/**
 * REQ-024 Session A3 (FR-6b; findings 76 and 123): the refused fill
 * submission's page as plain HTML. Next.js refuses the React server
 * renderer inside the app bundle, so the handler builds this form by hand: the message,
 * the fields with the typed values still in them (escaped), the required
 * tick, the three buttons, and a meta refresh to the clean screen after
 * ten minutes. No script, so no nonce; `autocomplete="off"` on every
 * field; nothing here is stored.
 */
import {
  EXPORT_SCREEN_PATH,
  FILL_CLEAR_MS,
  FILL_COPY,
  FILL_LIMITS,
  FILL_PATHS,
  NOTICE_PATH,
} from "./fill";
import type { WorkerFill } from "./worker-exports";

export type RefusalState = {
  fill: boolean;
  told: boolean;
  asAt: string;
  values: WorkerFill;
};

export const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const input = (
  name: string,
  value: string,
  attrs: Record<string, string | number | boolean | undefined> = {},
) => {
  const extra = Object.entries(attrs)
    .filter(([, v]) => v !== undefined && v !== false)
    .map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${esc(String(v))}"`))
    .join("");
  return `<input name="${esc(name)}" value="${esc(value)}" autocomplete="off"${extra}>`;
};

export function refusalFormHtml(input_: {
  brand: string;
  message: string;
  codes: readonly string[];
  pastCodes: readonly string[];
  supervisorRefs: readonly string[];
  state: RefusalState;
}): string {
  const { brand, message, codes, pastCodes, supervisorRefs, state } = input_;
  const seconds = Math.round(FILL_CLEAR_MS / 1000);
  const rows = [...codes, ...pastCodes]
    .map((code) => {
      const w = state.values.workers[code] ?? {};
      const past = pastCodes.includes(code)
        ? ' <span class="muted">past worker</span>'
        : "";
      return `<li data-testid="fill-row-${esc(code)}"><p><strong>${esc(code)}</strong>${past}</p>
<label>Full name ${input(`name:${code}`, w.full_name ?? "", { maxlength: FILL_LIMITS.name })}</label>
<label>Date of birth ${input(`dob:${code}`, w.date_of_birth ?? "", { type: "date" })}</label>
<label>Address ${input(`address:${code}`, w.address ?? "", { maxlength: FILL_LIMITS.address })}</label></li>`;
    })
    .join("\n");
  const supervisors = supervisorRefs
    .map(
      (ref) =>
        `<label>${esc(ref)}, full name ${input(`supervisor:${ref}`, state.values.supervisors[ref] ?? "", { maxlength: FILL_LIMITS.name })}</label>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="${seconds}; url=${EXPORT_SCREEN_PATH}">
<title>${esc(brand)}: the file was not built</title>
</head>
<body>
<main style="max-width:48rem;margin:0 auto;padding:1rem;font-family:system-ui,sans-serif;line-height:1.5">
<p><a href="${EXPORT_SCREEN_PATH}">&lsaquo; Worker files and the two Rules lists</a></p>
<h1>The file was not built</h1>
<p role="alert" data-testid="fill-message">${esc(message)}</p>
<form method="post" enctype="multipart/form-data" autocomplete="off" data-testid="fill-form">
<p><label>As at ${input("as_at", state.asAt, { type: "date" })}</label></p>
<p><label><input type="checkbox" name="fill" value="on" data-testid="fill-checkbox"${state.fill ? " checked" : ""}> ${esc(FILL_COPY.checkbox)}</label></p>
<p class="muted" data-testid="fill-owner-notice">${esc(FILL_COPY.ownerNotice)} ${esc(FILL_COPY.app36b)} <a href="${NOTICE_PATH}">Open the printable notice</a>.</p>
<p data-testid="fill-workers-only"><strong>${esc(FILL_COPY.workersOnly)}</strong></p>
<p><label><input type="checkbox" name="told" value="on" data-testid="fill-told"${state.told ? " checked" : ""}${state.fill ? " required" : ""}> ${esc(FILL_COPY.tick)}</label></p>
<ul>
${rows}
</ul>
${supervisors ? `<p><strong>Supervising workers (s 18(3)(c)(iii))</strong></p>\n${supervisors}` : ""}
<p><label>Assessor, name and title (s 17) ${input("assessor_name", state.values.assessor_name ?? "", { maxlength: FILL_LIMITS.name, "data-testid": "fill-assessor" })}</label></p>
<p>
<button type="submit" formaction="${FILL_PATHS["screening-list"]}" data-testid="fill-download-screening-list">Download the screening list (s 18)</button>
<button type="submit" formaction="${FILL_PATHS["risk-assessed-roles"]}" data-testid="fill-download-roles">Download the roles list (s 17)</button>
<button type="submit" formaction="${FILL_PATHS.workers}" data-testid="fill-download-workers">Download the worker files (zip)</button>
</p>
<p class="muted">A file is built from what is on this screen when you press the button and is sent to you once. ${esc(brand)} keeps no copy; this page returns to the clean screen ten minutes after it was shown.</p>
</form>
</main>
</body>
</html>`;
}
