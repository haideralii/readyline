-- D-2245 (PO 16 Oct 2026 14:00; the lesson of #73's runs 38836764150 and
-- 38840999461, D-2243): on the CLI's local stack, default privileges on
-- `public` hand `anon` and `authenticated` every privilege on a new table,
-- so a table whose migration granted `select` and revoked nothing held
-- insert, update, delete, references, trigger and truncate there and `select`
-- alone on the hosted project (D-422), and a refusal the suite asserted read
-- one way in CI and another in production. From here the grants are explicit
-- per verb: everything is revoked from the two client roles first, then every
-- grant the migrations state is re-stated, table by table, so the two stacks
-- hold the same privileges and `service-role-grants.test.ts` reads them back
-- from `information_schema.role_table_grants`. `service_role` keeps `all`
-- (`20261012080000`). Row-level security still decides which rows a grant
-- reaches; a table with no grant below is server-only.

-- 1. Nothing for the client roles until stated.
revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;

-- 2. Accounts and the questionnaire (D-422).
grant select, update on public.users to authenticated;
grant select, update on public.accounts to authenticated;
grant select, delete on public.memberships to authenticated;
grant select, insert, update, delete on public.questionnaire_drafts to authenticated;
-- `audit_log_insert_member` (20261011020000) lets a member write their own
-- account's rows, but no migration granted insert; the CLI stack's defaults
-- carried it, the hosted project never did (#76's run 38875536646), so the
-- three app paths writing under it had answered 42501 there since written.
grant select, insert on public.audit_log to authenticated;
grant select, insert, update, delete on public.account_facts to authenticated;

-- 3. Documents, payments and the subscription: members read; the server writes.
grant select on public.version_sets to authenticated;
grant select on public.document_versions to authenticated;
grant select on public.purchases to authenticated;
grant select on public.entitlements to authenticated;
grant select on public.generation_jobs to authenticated;
grant select on public.subscriptions to authenticated;
grant select, insert, update, delete on public.checklist_items to authenticated;

-- 4. The registers (REQ-009, REQ-018, REQ-020, REQ-023).
grant select, insert, update, delete on
  public.incidents, public.complaints, public.worker_clearances, public.policy_reviews
  to authenticated;
grant select, insert, delete on public.incident_events, public.complaint_events to authenticated;
grant select on public.reminders to authenticated;
grant select, insert, update, delete on
  public.corporate_risks, public.participant_risks, public.conflicts_of_interest,
  public.delegations, public.insurance_items, public.improvements,
  public.staff_matrix, public.onboarding_checklists, public.hazards
  to authenticated;
grant select, insert, delete on
  public.decisions, public.onboarding_ticks, public.register_events,
  public.policy_circulations, public.document_change_reviews, public.self_checks
  to authenticated;
grant select, insert on public.imports to authenticated;
grant update (undone_at) on public.imports to authenticated;
grant select, insert, update on public.auditor_links to authenticated;
grant select, insert, update on public.invitations to authenticated;
grant select, insert, update on public.report_links to authenticated;
grant select, insert, update on public.registration_periods to authenticated;

-- 5. The status views: read by the signed-in role and the server.
grant select on
  public.incidents_status, public.worker_clearances_status, public.policy_reviews_status,
  public.corporate_risks_status, public.participant_risks_status,
  public.conflicts_of_interest_status, public.insurance_items_status,
  public.improvements_status, public.staff_matrix_status,
  public.onboarding_checklists_status, public.hazards_status
  to authenticated, service_role;

-- 6. Server-only, so no grant: auth_rate_limits, generation_quota, generation_log,
--    stripe_events, register_sequences, daily_counters.

notify pgrst, 'reload schema';
