/**
 * Runs once when the Next.js server starts (REQ-002 FR-5, AC-4).
 * A missing required variable stops the process with a message naming it,
 * rather than letting a half-configured deployment serve traffic.
 * The Node-only work lives in a dynamically imported module so the Edge
 * compilation of this file stays free of Node API references.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { exitIfEnvInvalid } = await import("./lib/env-startup");
  exitIfEnvInvalid();
}
