-- REQ-021 (D-2101): what the provider sees while the pack is written comes
-- from the job row, never from a browser timer. The job records its phase,
-- the document and section in flight, the set's size, the time of the last
-- progress, and the documents that need another go (S4), and a job in that
-- state waits for the owner ('attention') instead of finishing or failing.

alter table public.generation_jobs
  drop constraint if exists generation_jobs_status_check;
alter table public.generation_jobs
  add constraint generation_jobs_status_check
  check (status in ('queued', 'running', 'ready', 'failed', 'attention'));

alter table public.generation_jobs
  add column if not exists phase text not null default 'preparing'
    check (phase in ('preparing', 'writing', 'checking', 'assembling', 'ready', 'attention', 'failed')),
  add column if not exists document_total integer,
  add column if not exists current_document_type_id text,
  add column if not exists current_section_index integer not null default 0,
  add column if not exists section_count integer not null default 0,
  add column if not exists last_progress_at timestamptz not null default now(),
  -- [{"typeId": "...", "kind": "error" | "degraded", "detail": "..."}]
  add column if not exists failed_documents jsonb not null default '[]'::jsonb;

-- The claim function is unchanged: only queued and running jobs are claimable,
-- so an 'attention' job waits for the owner's "Try again" or "Continue".

-- Members read the new columns through the existing select policy and grant;
-- nothing is granted to clients for writing (the job route and the owner's
-- server actions use the service key).
grant select on public.generation_jobs to authenticated;
revoke insert, update, delete on public.generation_jobs from anon, authenticated;

-- PostgREST reads the new columns after a schema reload.
notify pgrst, 'reload schema';
