/**
 * Who asked for a run of the paid generation job (batch 32 item 4, D-1006),
 * so the `payments.generation.tick` log line says which path moved the
 * chain: the route's own hand-on, the documents page's nudge, the GitHub
 * Actions kicker, Vercel Cron, the Stripe webhook's hook, or a person with
 * the bearer. Pure, so the route and the unit test share it.
 */
export type KickedBy =
  "self" | "page" | "kicker" | "manual" | "cron" | "webhook";

export function kickedByFrom(
  kick: string | undefined,
  userAgent: string | null,
): KickedBy {
  if (kick === "1" || kick === "self") return "self";
  if (kick === "kicker") return "kicker";
  if (kick === "manual") return "manual";
  return userAgent?.toLowerCase().startsWith("vercel-cron") ? "cron" : "manual";
}
