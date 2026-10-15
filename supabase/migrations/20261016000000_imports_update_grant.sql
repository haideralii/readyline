-- Retro review of REQ-020, finding 33, second look (16 Oct 2026, run
-- 38779174050; D-2241). `20261015060000` granted `update (undone_at)` on
-- public.imports and relied on no table-level update existing for
-- `authenticated`. Where a default privilege reaches the table (the CLI's
-- local stack grants `authenticated` everything in `public`, see
-- 20261013000000 line 537) that assumption fails and a member could update
-- any column of an import row; the undo-only rule then held on the hosted
-- project alone. Revoking the table privilege also drops the column
-- privileges (Postgres REVOKE), so the explicit grants are re-made after it.
-- Idempotent: grants and revokes can run again without change.

revoke all on public.imports from anon, authenticated;
grant select, insert on public.imports to authenticated;
grant update (undone_at) on public.imports to authenticated;

notify pgrst, 'reload schema';
