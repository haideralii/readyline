/**
 * Prebuild environment check (REQ-010 FR-2, AC-2). Runs before `next build`
 * through the `prebuild` script. On the Vercel production deployment every
 * variable in PRODUCTION_REQUIRED must be present, or the build stops naming
 * the missing ones; anywhere else only the short REQUIRED list applies, so
 * previews, CI and local builds are unaffected. The `.env*` files are read
 * the way Next.js reads them (so a local build sees `.env.local`); values
 * are never printed.
 *
 *   node --experimental-strip-types scripts/ops/check-env.ts
 */
import nextEnv from "@next/env";
import { isProductionDeployment, validateEnv } from "../../src/lib/env.ts";

// CommonJS module: the named export is not available to an ES import.
nextEnv.loadEnvConfig(process.cwd(), false, {
  info: () => {},
  error: console.error,
});

const production = isProductionDeployment(process.env);
const result = validateEnv(process.env, { production });
if (!result.ok) {
  console.error(
    `check-env: the ${production ? "production" : "basic"} environment is incomplete; refusing to build.`,
  );
  for (const p of result.problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(
  `check-env ok (${production ? "production" : "basic"} list; values not shown)`,
);
