import "server-only";
/**
 * REQ-024 Session A3: the three fill handlers as one implementation
 * (FR-6b; SR-7, SR-8). `POST /registers/staff/export/<kind>` behind the
 * origin check and the member gate, outside the subscription gate
 * (D-2422), under the fill's own limit of ten an hour per account. The
 * body is read once, parsed, turned into one file and sent as an
 * attachment under `Cache-Control: no-store`; a refusal returns the form
 * with the typed values still in the page and a plain message, under
 * `no-store` too, with a count-only audit line (SR-8(d); findings 76 and
 * 123). Nothing is written anywhere.
 */
import { NextResponse } from "next/server";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BRAND } from "@/lib/brand";
import { log } from "@/lib/logging/logger";
import {
  EXPORT_SCREEN_PATH,
  FILL_CLEAR_MS,
  FILL_COPY,
  FILL_LIMITS,
  parseFill,
  type FillKind,
} from "@/lib/registers/fill";
import type { WorkerFill } from "@/lib/registers/worker-exports";
import { FillFormFields } from "@/app/registers/_components/fill-form";
import { getViewer } from "@/server/accounts/queries";
import { checkFillAllowed } from "@/server/auth/rate-limit";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { performFill, postedFromExportScreen } from "./fill";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** The typed values as typed, for the refused form; lengths capped, nothing else read. */
export function rawFillValues(form: FormData): {
  fill: boolean;
  told: boolean;
  asAt: string;
  values: WorkerFill;
} {
  const values: WorkerFill = { workers: {}, supervisors: {} };
  let fill = false;
  let told = false;
  let asAt = "";
  for (const [key, raw] of form.entries()) {
    if (typeof raw !== "string") continue;
    const v = raw.slice(0, FILL_LIMITS.address);
    if (key === "fill") fill = v === "on" || v === "1";
    else if (key === "told") told = v === "on" || v === "1";
    else if (key === "as_at") asAt = v.slice(0, 10);
    else if (key === "assessor_name") values.assessor_name = v;
    else {
      const m = /^(name|dob|address|supervisor):(.+)$/.exec(key);
      if (!m) continue;
      const [, field, ref] = m;
      if (field === "supervisor") values.supervisors[ref] = v;
      else {
        const w = (values.workers[ref] ??= {});
        if (field === "name") w.full_name = v;
        else if (field === "dob") w.date_of_birth = v;
        else w.address = v;
      }
    }
  }
  return { fill, told, asAt, values };
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The refused submission's page: the form again, the message, a clean screen after ten minutes (no script, so no nonce). */
export function refusalHtml(input: {
  message: string;
  codes: readonly string[];
  pastCodes: readonly string[];
  supervisorRefs: readonly string[];
  state: ReturnType<typeof rawFillValues>;
}): string {
  const form = renderToStaticMarkup(
    createElement(FillFormFields, {
      codes: input.codes,
      pastCodes: input.pastCodes,
      supervisorRefs: input.supervisorRefs,
      assessorDefault: "",
      state: input.state,
      message: input.message,
    }),
  );
  const seconds = Math.round(FILL_CLEAR_MS / 1000);
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="${seconds}; url=${EXPORT_SCREEN_PATH}">
<title>${esc(BRAND)}: the file was not built</title>
</head>
<body>
<main style="max-width:48rem;margin:0 auto;padding:1rem;font-family:system-ui,sans-serif;line-height:1.5">
<p><a href="${EXPORT_SCREEN_PATH}">&lsaquo; Worker files and the two Rules lists</a></p>
<h1>The file was not built</h1>
<form method="post" enctype="multipart/form-data" autocomplete="off">${form}</form>
</main>
</body>
</html>`;
}

async function codesFor(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  accountId: string,
) {
  const [rows, exceptions] = await Promise.all([
    supabase
      .from("staff_matrix")
      .select("worker_ref, ended_on")
      .eq("account_id", accountId)
      .order("worker_ref", { ascending: true }),
    supabase
      .from("screening_exceptions")
      .select("supervisor_ref")
      .eq("account_id", accountId)
      .not("supervisor_ref", "is", null),
  ]);
  const all =
    (rows.data as { worker_ref: string; ended_on: string | null }[] | null) ??
    [];
  return {
    codes: all.filter((r) => !r.ended_on).map((r) => r.worker_ref),
    pastCodes: all.filter((r) => r.ended_on).map((r) => r.worker_ref),
    supervisorRefs: [
      ...new Set(
        ((exceptions.data as { supervisor_ref: string }[] | null) ?? []).map(
          (e) => e.supervisor_ref,
        ),
      ),
    ],
  };
}

export function makeFillHandler(kind: FillKind) {
  return async function POST(request: Request) {
    if (!postedFromExportScreen(request))
      return new NextResponse("Forbidden", { status: 403, headers: NO_STORE });
    const viewer = await getViewer();
    if (!viewer)
      return NextResponse.redirect(
        new URL(
          `/sign-in?next=${encodeURIComponent(EXPORT_SCREEN_PATH)}`,
          new URL(request.url).origin,
        ),
        303,
      );
    if (!viewer.account || viewer.deleted)
      return new NextResponse("Not found", { status: 404, headers: NO_STORE });
    const accountId = viewer.account.id;
    const form = await request.formData();
    const supabase = await createSupabaseServerClient();

    const refuse = async (message: string, status: number) => {
      // SR-8(d): the error path writes the count-only line and returns the form; no value reaches a log.
      await supabase.from("audit_log").insert({
        account_id: accountId,
        actor_user_id: viewer.user.id,
        action: `exports.${kind}.refused`,
        target: accountId,
      });
      log.info("exports.fill.refused", { accountId, kind, status });
      const html = refusalHtml({
        message,
        ...(await codesFor(supabase, accountId)),
        state: rawFillValues(form),
      });
      return new NextResponse(html, {
        status,
        headers: { ...NO_STORE, "Content-Type": "text/html; charset=utf-8" },
      });
    };

    const parsed = parseFill(kind, form.entries());
    if (!parsed.ok) return refuse(parsed.message, 400);
    if (!(await checkFillAllowed(accountId))) {
      log.warn("exports.fill.rate-limited", { accountId, kind });
      return refuse(FILL_COPY.refused, 429);
    }
    const { file } = await performFill({
      supabase,
      accountId,
      userId: viewer.user.id,
      submission: parsed.submission,
    });
    return new NextResponse(new Uint8Array(file.body), {
      status: 200,
      headers: {
        ...NO_STORE,
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.fileName}"`,
      },
    });
  };
}
