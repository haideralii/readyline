-- REQ-004 FR-10 / D-422: explicit table privileges for the signed-in role.
-- The hosted project answered the account read-back with 42501 (permission
-- denied on memberships for `authenticated`): earlier migrations created
-- tables and policies but never granted table privileges, relying on the
-- local stack's default privileges, which the hosted project does not share
-- (the same gap D-538 closed for functions). Row-level security still decides
-- which rows a grant reaches. Every grant below mirrors an existing policy;
-- `grant` is idempotent, so re-applying changes nothing.

grant usage on schema public to anon, authenticated;

-- REQ-004 (20261011000000, 20261011020000)
grant select, update on public.users to authenticated;
grant select, update on public.accounts to authenticated;
grant select on public.memberships to authenticated;
grant select, insert, update, delete on public.questionnaire_drafts to authenticated;
grant select on public.audit_log to authenticated;

-- REQ-005 (20261012000000): members read their sets and versions; writes are server-side.
grant select on public.version_sets to authenticated;
grant select on public.document_versions to authenticated;

-- REQ-007 (20261012030000): owners read purchases and entitlements, members read job status.
grant select on public.purchases to authenticated;
grant select on public.entitlements to authenticated;
grant select on public.generation_jobs to authenticated;

-- Server-only tables stay closed (no grant): auth_rate_limits, generation_log,
-- generation_quota, stripe_events.

notify pgrst, 'reload schema';
