-- REQ-006 Session B: the readiness checklist's status and notes per account
-- and item (FR-3, SR-1, SR-2). Items themselves are derived from the result
-- at request time; only what the provider sets is stored, so nothing exists
-- for an untouched item (FR-5). Members read and write their own account's
-- rows; nothing is written for another account. Notes are free text the
-- provider controls, capped at 500 characters, with the no-participant-data
-- warning on the field. Rows go with the account (cascade) at purge.

create table public.checklist_items (
  account_id uuid not null references public.accounts (id) on delete cascade,
  -- "<group>:<slug>" from src/lib/checklist/derive.ts.
  item_id text not null check (item_id ~ '^[a-z]+:[a-z0-9-]+$'),
  status text not null default 'need' check (status in ('need', 'in-progress', 'have')),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (account_id, item_id)
);
create trigger checklist_items_set_updated_at
  before update on public.checklist_items
  for each row execute function public.set_updated_at();

alter table public.checklist_items enable row level security;

create policy checklist_items_select_member on public.checklist_items
  for select to authenticated using (public.is_member(account_id));
create policy checklist_items_insert_member on public.checklist_items
  for insert to authenticated with check (public.is_member(account_id));
create policy checklist_items_update_member on public.checklist_items
  for update to authenticated using (public.is_member(account_id)) with check (public.is_member(account_id));
create policy checklist_items_delete_member on public.checklist_items
  for delete to authenticated using (public.is_member(account_id));

-- Explicit privileges: the hosted project carries no default grants (D-422, D-711).
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on public.checklist_items to authenticated;
grant all privileges on public.checklist_items to service_role;

notify pgrst, 'reload schema';
