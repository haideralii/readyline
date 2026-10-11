/**
 * Node-only startup check used by src/instrumentation.ts (REQ-002 AC-4).
 * Kept out of instrumentation.ts itself because that file is also compiled
 * for the Edge runtime, where Turbopack warns about `process.exit`.
 */
import { validateEnv } from "./env";

export function exitIfEnvInvalid(): void {
  const result = validateEnv();
  if (result.ok) return;
  const nodeProcess = globalThis.process;
  nodeProcess.stderr.write(
    `\nEnvironment check failed; refusing to start.\n${result.problems
      .map((p) => `  - ${p}`)
      .join(
        "\n",
      )}\nSee .env.example for every variable and where it lives in production.\n\n`,
  );
  nodeProcess.exit(1);
}
