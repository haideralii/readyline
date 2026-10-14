-- Living policies (standing backlog 8, D-551): when the owner has read a
-- document against a rule change and is satisfied, the check is recorded
-- here; the document control register then stops asking. Append-only like
-- the other evidence tables (D-906): no update for clients, delete for the
-- owner only. The changes themselves live in the repo (data/watch-changes.json).

create table public.document_change_reviews (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  document_type_id text not null check (document_type_id ~ '^[a-z0-9-]{1,80}$'),
  change_id text not null check (change_id ~ '^wc-[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{2}$'),
  reviewed_on date not null default (now() at time zone 'Australia/Sydney')::date,
  reviewer_ref text check (reviewer_ref is null or reviewer_ref ~ '^(W|KP)-?[0-9]{1,6}$'),
  note text not null default '' check (char_length(note) <= 300 and not public.looks_like_ndis_number(note)),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (account_id, document_type_id, change_id)
);
create index document_change_reviews_account_idx on public.document_change_reviews (account_id, document_type_id);

alter table public.document_change_reviews enable row level security;
create policy document_change_reviews_select_member on public.document_change_reviews
  for select to authenticated using (public.is_member(account_id));
-- Written from the register by an owner who has read the document; the pack buyer walks this without the subscription gate, like circulation ticks.
create policy document_change_reviews_insert_owner on public.document_change_reviews
  for insert to authenticated with check (public.is_owner(account_id));
create policy document_change_reviews_delete_owner on public.document_change_reviews
  for delete to authenticated using (public.is_owner(account_id));

grant select, insert, delete on public.document_change_reviews to authenticated;
revoke update on public.document_change_reviews from anon, authenticated;
grant all privileges on public.document_change_reviews to service_role;
revoke all on public.document_change_reviews from anon;

notify pgrst, 'reload schema';
