import { describe, expect, it } from "vitest";
import { kickedByFrom } from "./kicked-by";

describe("kickedByFrom (batch 32 item 4, D-1006)", () => {
  it("names the path that called the route", () => {
    expect(kickedByFrom("1", null)).toBe("self");
    expect(kickedByFrom("self", "curl/8")).toBe("self");
    expect(kickedByFrom("kicker", "node")).toBe("kicker");
    expect(kickedByFrom("manual", "vercel-cron/1.0")).toBe("manual");
    expect(kickedByFrom(undefined, "vercel-cron/1.0")).toBe("cron");
    expect(kickedByFrom("0", "Vercel-Cron/1.0")).toBe("cron");
    expect(kickedByFrom(undefined, "curl/8")).toBe("manual");
    expect(kickedByFrom(undefined, null)).toBe("manual");
  });
});
