-- REQ-007 Session C: claim the next runnable generation job (FR-5, D-706).
-- One row at a time, skip-locked so two ticks never take the same job; the
-- lease is next_run_at, so a tick that dies leaves a job that becomes
-- claimable again when the lease passes. Only the job route and the
-- webhook's after() hook call it, with the secret key (D-538).

create or replace function public.claim_generation_job(p_lease_seconds integer)
returns setof public.generation_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with next as (
    select id
    from public.generation_jobs
    where status in ('queued', 'running')
      and next_run_at <= now()
    order by created_at
    limit 1
    for update skip locked
  )
  update public.generation_jobs j
  set status = 'running',
      next_run_at = now() + make_interval(secs => greatest(p_lease_seconds, 30))
  from next
  where j.id = next.id
  returning j.*;
end;
$$;

revoke all on function public.claim_generation_job(integer) from public, anon, authenticated;
grant execute on function public.claim_generation_job(integer) to service_role;
