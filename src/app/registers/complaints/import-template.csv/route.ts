import { NextResponse } from "next/server";
import { parseInput, strictObject } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import { templateResponse } from "@/server/registers/import-template-route";

/** GET /registers/complaints/import-template.csv: the empty import template, header row only (REQ-020 FR-8). Signed-in members only; no query parameters. */
const NoQuery = strictObject({});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = parseInput(
    NoQuery,
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!query.ok) return new NextResponse("Bad request", { status: 400 });
  return templateResponse("complaints", url.origin, await getViewer());
}
