/**
 * Stands in for Next's `server-only` guard under the integration Vitest
 * project (batch 38, D-1008). The guard throws when a module marked
 * `import "server-only"` is loaded outside a Next server bundle, which is
 * exactly what these tests do on purpose: they drive the server modules
 * (the reminders job, the email provider, the admin client) against a real
 * Supabase stack. The unit project reaches the same modules through
 * `vi.mock("server-only", () => ({}))` in each test; here the alias in
 * `vitest.integration.config.mts` does it for every file.
 */
export {};
