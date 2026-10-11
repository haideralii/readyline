# Validation at the boundary

Every route handler (`src/app/**/route.ts`) and every server action file (one
that contains `"use server"`) must:

1. import `parseInput` and `strictObject` from `@/lib/validation`;
2. define its input schema with `strictObject` (unknown keys are rejected) and
   cap free text with `text(max)`;
3. call `parseInput(schema, input)` and return the `fieldErrors` / `formErrors`
   to the UI on failure. Never throw a raw zod error to the client.

Why: the threat model requires validation at every boundary with unknown keys
rejected and lengths capped. A lint rule cannot tell which files are
boundaries, so `handlers.test.ts` walks `src/` and fails the unit suite the
moment a handler or action skips the layer or uses `z.object` directly.

Schemas shared by several boundaries go in `src/lib/validation/schemas/`.
