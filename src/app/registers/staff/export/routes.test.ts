import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FILL_KINDS, FILL_PREFERRED_REGION } from "@/lib/registers/fill";

/**
 * REQ-024 SR-8(e) (finding 33): the three fill handlers are pinned to Sydney
 * in code and rendered on every request. Next.js reads a route segment's
 * config as literals, so the test reads the literals from each route file
 * and holds them to the constant the switchboard shows.
 */
describe("the fill handlers' route config", () => {
  for (const kind of FILL_KINDS) {
    it(`${kind}: preferredRegion syd1, dynamic force-dynamic, nodejs runtime`, () => {
      const source = readFileSync(join(__dirname, kind, "route.ts"), "utf8");
      expect(source).toContain(
        `export const preferredRegion = "${FILL_PREFERRED_REGION}";`,
      );
      expect(FILL_PREFERRED_REGION).toBe("syd1");
      expect(source).toContain(`export const dynamic = "force-dynamic";`);
      expect(source).toContain(`export const runtime = "nodejs";`);
      expect(source).toContain(`makeFillHandler("${kind}", strictObject({}))`);
    });
  }
});
