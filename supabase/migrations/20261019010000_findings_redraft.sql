-- REQ-033 Session B (FR-B5, FR-B6, SR-B5; D-2955, D-2958): a finding row
-- carries the version its accepted redraft made and the section it changed;
-- a generation_log row says when it was a redraft (the finding's reference,
-- never its words). No new table: the version is a document_versions row,
-- inserted by the service role inside the action (SR-B4), unadopted until
-- the provider adopts it through the existing flow (D-2855).

alter table public.findings
  add column if not exists redraft_version_id uuid references public.document_versions (id) on delete set null,
  add column if not exists redraft_section_id text not null default ''
    check (redraft_section_id ~ '^[a-z0-9.-]{0,60}$');

-- The status view selected f.* at creation and does not learn new columns;
-- recreated with the same body and grants (REQ-033 Session A).
drop view if exists public.findings_status;
create view public.findings_status with (security_invoker = true) as
select
  f.*,
  case
    when f.status = 'open' and f.due_on is not null and f.due_on < public.sydney_today() then 'overdue'
    else f.status
  end as state
from public.findings f;
revoke all on public.findings_status from anon, authenticated;
grant select on public.findings_status to authenticated, service_role;

-- SR-B5: "redraft:FND-0001" on a redraft's log row; '' on a section's.
alter table public.generation_log
  add column if not exists source text not null default ''
    check (char_length(source) <= 40);
