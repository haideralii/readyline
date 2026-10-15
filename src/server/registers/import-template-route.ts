/**
 * GET /registers/<slug>/import-template.csv: the empty template for a
 * register's import (REQ-020 FR-8), the header row in our export's column
 * names. Each route file parses its (empty) query and reads the viewer
 * itself, because the boundary guards in `handlers.test.ts` look for the
 * validation import and the session gate where the route lives; this
 * module only writes the response. No account data is in the file, so no
 * rate limit.
 */
import { NextResponse } from "next/server";
import {
  IMPORT_SLUGS,
  importTemplate,
  type ImportRegister,
} from "@/lib/registers/import";
import type { getViewer } from "@/server/accounts/queries";

export function templateResponse(
  register: ImportRegister,
  origin: string,
  viewer: Awaited<ReturnType<typeof getViewer>>,
): NextResponse {
  const slug = IMPORT_SLUGS[register];
  if (!viewer)
    return NextResponse.redirect(
      new URL(`/sign-in?next=%2Fregisters%2F${slug}%2Fimport`, origin),
    );
  if (!viewer.account) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(importTemplate(register), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-import-template.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
