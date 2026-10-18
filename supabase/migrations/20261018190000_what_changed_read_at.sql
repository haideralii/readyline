-- REQ-031 Session B (FR-5; D-2890): the owner's reading of "What changed since the last audit",
-- kept on the period row and null until the page has been opened in this period. The row's
-- policies are unchanged (20261016010000_registration_periods.sql: members read, the owner
-- writes; the grants are per table, so no new grant), SR-6.
alter table public.registration_periods
  add column what_changed_read_at timestamptz;

notify pgrst, 'reload schema';
