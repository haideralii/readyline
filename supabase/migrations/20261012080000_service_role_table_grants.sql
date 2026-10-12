-- REQ-007 Session C / D-711: explicit table privileges for the secret-key role.
-- A read-only probe of the hosted project with the secret key answered 42501
-- (permission denied) on every public table: accounts, memberships,
-- questionnaire_drafts, version_sets, document_versions, generation_log,
-- audit_log, auth_rate_limits. The hosted project does not carry the local
-- stack's default privileges (the gap D-538 closed for functions and D-422
-- closes for `authenticated`), so everything the server does with the admin
-- client (the purge job, the generation store, the payment store, the paid
-- generation job, audit entries) needs these grants. `service_role` bypasses
-- row-level security by design; the grants only make the tables reachable.
-- Idempotent: re-applying changes nothing.

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

-- Tables and sequences created by later migrations run by this same role.
alter default privileges in schema public grant all privileges on tables to service_role;
alter default privileges in schema public grant all privileges on sequences to service_role;

notify pgrst, 'reload schema';
