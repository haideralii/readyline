import { NextResponse } from "next/server";
import { parseInput, strictObject } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import { templateResponse } from "@/server/registers/import-template-route";

/** GET /registers/commission-changes/import-template.csv: the empty import template, header row only (REQ-020 FR-8; REQ-023 FR-10). Signed-in members only; no query parameters. */
const NoQuery = strictObject({});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = parseInput(
    NoQuery,
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!query.ok) return new NextResponse("Bad request", { status: 400 });
  return templateResponse("commission_changes", url.origin, await getViewer());
}
