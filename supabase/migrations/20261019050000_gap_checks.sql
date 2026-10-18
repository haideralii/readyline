-- REQ-035 Session A (FR-4, SR-3; D-2962, D-2966): the gap check's list. One row per check the
-- owner runs on a policy they already have (the document type it stands for, the title they
-- typed, the counts), and one row per outline section with its state and the reason sentence.
-- Nothing of the provider's document is stored: the action reads it in the request and drops
-- it; the reason sentences are the model's, cleaned of any eight-word run from the text.

create table public.gap_checks (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  -- A document-types.json id ("complaints-management-policy-and-register").
  document_type_id text not null check (document_type_id ~ '^[a-z0-9-]{1,120}$'),
  -- The provider's own name for their document (FR-1), gated by the participant detector in the action.
  title text not null check (char_length(title) between 1 and 120 and not public.looks_like_ndis_number(title)),
  covered integer not null default 0 check (covered >= 0),
  partly integer not null default 0 check (partly >= 0),
  missing integer not null default 0 check (missing >= 0),
  prompt_version text not null check (char_length(prompt_version) <= 40),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index gap_checks_account_idx on public.gap_checks (account_id, created_at desc);

create table public.gap_check_sections (
  id uuid primary key default gen_random_uuid(),
  gap_check_id uuid not null references public.gap_checks (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  section_id text not null check (section_id ~ '^[a-z0-9-]{1,80}$'),
  -- "1", "2", … or '' for the front and back matter, as the outline numbers them.
  number text not null default '' check (number ~ '^[0-9]{0,3}$'),
  heading text not null check (char_length(heading) between 1 and 120),
  position integer not null check (position >= 0),
  state text not null check (state in ('covered', 'partly', 'missing')),
  reason text not null check (char_length(reason) between 1 and 300 and not public.looks_like_ndis_number(reason)),
  standard_ids text[] not null default '{}',
  indicator_labels text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index gap_check_sections_check_idx on public.gap_check_sections (gap_check_id, position);
create index gap_check_sections_account_idx on public.gap_check_sections (account_id);

-- RLS: members read, the owner runs and removes a check, nothing is edited (SR-3).
alter table public.gap_checks enable row level security;
create policy gap_checks_select_member on public.gap_checks
  for select to authenticated using (public.is_member(account_id));
create policy gap_checks_insert_owner on public.gap_checks
  for insert to authenticated with check (public.is_owner(account_id));
create policy gap_checks_delete_owner on public.gap_checks
  for delete to authenticated using (public.is_owner(account_id));

alter table public.gap_check_sections enable row level security;
create policy gap_check_sections_select_member on public.gap_check_sections
  for select to authenticated using (public.is_member(account_id));
create policy gap_check_sections_insert_owner on public.gap_check_sections
  for insert to authenticated with check (public.is_owner(account_id));
create policy gap_check_sections_delete_owner on public.gap_check_sections
  for delete to authenticated using (public.is_owner(account_id));

-- Grants: revoke then grant (D-2245); no update for anyone but the service role.
revoke all on public.gap_checks from anon, authenticated;
grant select, insert, delete on public.gap_checks to authenticated;
grant all privileges on public.gap_checks to service_role;
revoke all on public.gap_check_sections from anon, authenticated;
grant select, insert, delete on public.gap_check_sections to authenticated;
grant all privileges on public.gap_check_sections to service_role;
