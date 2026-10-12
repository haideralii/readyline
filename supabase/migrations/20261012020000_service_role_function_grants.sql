-- REQ-005 R-11 / D-538: functions meant for the server's secret key need an
-- explicit execute grant to service_role. Earlier migrations revoked execute
-- from public, anon and authenticated and relied on the local stack's default
-- privileges for service_role; the hosted project has no such default, so the
-- magic-link limiter failed with 42501 on the first real sign-in.
--
-- The hosted project (dpwwzhylcyosnkmlcnnp) already carries these two grants,
-- applied by hand in the SQL editor on 12 Oct 2026; `grant` is idempotent, so
-- applying this migration there changes nothing.
--
-- Functions called through the secret key today (src/server/**/*.ts):
--   auth_rate_limit_hit(text, integer, integer)   src/server/auth/rate-limit.ts
--   generation_quota_hit(uuid)                     src/server/generation/actions.ts
-- create_account() and delete_account() run as the signed-in user and keep
-- their grants to authenticated. The purge job and the admin pages use table
-- access only, which service_role has.
grant execute on function public.auth_rate_limit_hit(text, integer, integer) to service_role;
grant execute on function public.generation_quota_hit(uuid) to service_role;
