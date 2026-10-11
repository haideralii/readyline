-- REQ-005 Session C: generated document sets, versions, generation log,
-- per-account quota and the private documents bucket.
-- Members read their account's rows through RLS; every write happens in
-- server code with the service key after an ownership check (D-516).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.version_sets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  created_by uuid,
  -- SHA-256 of the canonical answers; lets the UI say "same answers as last time".
  answers_snapshot_hash text not null,
  derived_result jsonb not null,
  status text not null check (status in ('generating', 'ready', 'failed')),
  document_count integer not null default 0,
  fallback_section_count integer not null default 0,
  generated_count integer not null default 0,
  storage_prefix text not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index version_sets_account_created_idx on public.version_sets (account_id, created_at desc);

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  version_set_id uuid not null references public.version_sets (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  document_type_id text not null,
  version integer not null check (version >= 1),
  status text not null check (status in ('ready', 'review')),
  storage_path text not null,
  -- The resolved document model (sections, blocks, usedFacts): drives the reviewer view and diffs.
  model jsonb not null,
  created_at timestamptz not null default now(),
  unique (version_set_id, document_type_id, version)
);
create index document_versions_account_idx on public.document_versions (account_id, created_at desc);

-- Counts only, never prompt or reply text (SR-5).
create table public.generation_log (
  id bigint generated always as identity primary key,
  account_id uuid references public.accounts (id) on delete set null,
  version_set_id uuid references public.version_sets (id) on delete set null,
  document_type_id text not null,
  section_id text not null,
  prompt_version text not null,
  model text not null,
  request_hash text not null,
  status text not null check (status in ('generated', 'fallback')),
  attempts integer not null,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);
create index generation_log_account_created_idx on public.generation_log (account_id, created_at desc);

-- Per-account daily quota (FR-9, SR-6). The limit can be raised per account by an operator.
alter table public.accounts
  add column generation_daily_limit integer not null default 5
  check (generation_daily_limit between 0 and 100);

create table public.generation_quota (
  account_id uuid not null references public.accounts (id) on delete cascade,
  day date not null,
  count integer not null default 0,
  primary key (account_id, day)
);

-- One statement: increments today's count and says whether it stayed within the limit.
create or replace function public.generation_quota_hit(p_account uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_count integer;
begin
  select generation_daily_limit into v_limit from public.accounts where id = p_account and deleted_at is null;
  if v_limit is null then
    return false;
  end if;
  insert into public.generation_quota (account_id, day, count)
  values (p_account, (now() at time zone 'Australia/Sydney')::date, 1)
  on conflict (account_id, day) do update set count = public.generation_quota.count + 1
  returning count into v_count;
  return v_count <= v_limit;
end;
$$;
revoke all on function public.generation_quota_hit(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security: members read; no client writes.
-- ---------------------------------------------------------------------------

alter table public.version_sets enable row level security;
alter table public.document_versions enable row level security;
alter table public.generation_log enable row level security;
alter table public.generation_quota enable row level security;

create policy version_sets_select_member on public.version_sets
  for select to authenticated using (public.is_member(account_id));
create policy document_versions_select_member on public.document_versions
  for select to authenticated using (public.is_member(account_id));
create policy generation_log_select_owner on public.generation_log
  for select to authenticated using (public.is_owner(account_id));
-- generation_quota: no client policy; the function and the service key only.
revoke all on public.generation_quota from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket, objects namespaced by account id (SR-4).
-- Paths are "<account_id>/<version_set_id>/<file>"; members may read their
-- account's folder, nobody writes through the API (service key only).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  26214400,
  array['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/pdf', 'application/zip', 'application/json']
)
on conflict (id) do nothing;

create policy documents_select_member on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public.is_member(((storage.foldername(name))[1])::uuid)
  );
