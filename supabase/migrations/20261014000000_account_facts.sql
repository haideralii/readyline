-- REQ-017 FR-2 (D-1702): the facts a provider gives once on the "Finish your
-- pack" path (the person responsible, their role, how to reach them, the
-- approval date, the record-keeping period), one row per fact key, so every
-- blank in this pack and the next is filled from them. Business facts only;
-- the keys are a closed list in src/lib/generator/facts-fill.ts and the
-- values are short text the owner typed about their own business, never a
-- participant (the form carries the participant-data warning, CLAUDE.md 4.5).
-- Grants stated explicitly (D-052): owners read and write their own rows;
-- the job runner (service role) reads them to fill a new pack.

create table public.account_facts (
  account_id uuid not null references public.accounts (id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9-]{0,39}$'),
  value text not null check (char_length(value) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (account_id, key)
);
create trigger account_facts_set_updated_at
  before update on public.account_facts
  for each row execute function public.set_updated_at();

alter table public.account_facts enable row level security;
create policy account_facts_select_owner on public.account_facts
  for select to authenticated using (public.is_owner(account_id));
create policy account_facts_insert_owner on public.account_facts
  for insert to authenticated with check (public.is_owner(account_id));
create policy account_facts_update_owner on public.account_facts
  for update to authenticated using (public.is_owner(account_id)) with check (public.is_owner(account_id));
create policy account_facts_delete_owner on public.account_facts
  for delete to authenticated using (public.is_owner(account_id));

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on public.account_facts to authenticated;
grant all privileges on public.account_facts to service_role;
revoke all on public.account_facts from anon;

notify pgrst, 'reload schema';
