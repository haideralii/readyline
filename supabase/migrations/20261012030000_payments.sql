-- REQ-007 Session A: purchases, entitlements, Stripe event ledger and the
-- generation job queue (FR-4, FR-5, SR-2). Owners read their own rows through
-- RLS; nothing is written from a client: the webhook and the job runner write
-- with the secret key (D-701).

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  -- Null only for a refund that arrived before its checkout.session.completed event (SR-2).
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null check (currency = 'aud'),
  status text not null check (status in ('paid', 'refunded')),
  receipt_url text,
  created_at timestamptz not null default now(),
  refunded_at timestamptz
);
create index purchases_account_created_idx on public.purchases (account_id, created_at desc);

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  kind text not null check (kind in ('pack', 'subscription')),
  -- The answers snapshot the pack was bought for (metadata.assessment_id).
  assessment_id text,
  source_purchase_id uuid references public.purchases (id) on delete set null,
  -- Set once the set has been generated for this entitlement (FR-5: generated once).
  version_set_id uuid references public.version_sets (id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index entitlements_account_granted_idx on public.entitlements (account_id, granted_at desc);

-- Ids only, never payloads (SR-6). A replayed event finds its id here and is a no-op.
create table public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

-- Out-of-band generation after an entitlement (FR-5): one row per granted pack,
-- advanced document by document by the job route.
create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  purchase_id uuid references public.purchases (id) on delete set null,
  entitlement_id uuid references public.entitlements (id) on delete cascade,
  assessment_id text,
  status text not null default 'queued' check (status in ('queued', 'running', 'ready', 'failed')),
  attempts integer not null default 0,
  next_document_index integer not null default 0,
  version_set_id uuid references public.version_sets (id) on delete set null,
  -- The document in flight: its finished tailored sections and their log rows,
  -- so a tick can stop between sections and the next tick carries on (D-706).
  progress jsonb not null default '{}'::jsonb,
  last_error text,
  -- Doubles as the lease while a tick runs: a job whose lease has passed is claimable again.
  next_run_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index generation_jobs_runnable_idx on public.generation_jobs (status, next_run_at);
create index generation_jobs_account_idx on public.generation_jobs (account_id, created_at desc);
create trigger generation_jobs_set_updated_at
  before update on public.generation_jobs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security: owners read purchases and entitlements, members read the
-- job status; no client writes anywhere; the event ledger is server-only.
-- ---------------------------------------------------------------------------

alter table public.purchases enable row level security;
alter table public.entitlements enable row level security;
alter table public.stripe_events enable row level security;
alter table public.generation_jobs enable row level security;

create policy purchases_select_owner on public.purchases
  for select to authenticated using (public.is_owner(account_id));
create policy entitlements_select_owner on public.entitlements
  for select to authenticated using (public.is_owner(account_id));
create policy generation_jobs_select_member on public.generation_jobs
  for select to authenticated using (public.is_member(account_id));

revoke insert, update, delete on public.purchases, public.entitlements, public.generation_jobs from anon, authenticated;
revoke all on public.stripe_events from anon, authenticated;
