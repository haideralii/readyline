-- REQ-004 FR-10: PostgREST caches the schema; after migrations applied over
-- the database connection (migrate.yml) a new table or relationship can be
-- missing from the cache until it reloads, which surfaced on the hosted
-- project as the account read-back failing right after create_account.
-- Asking PostgREST to reload at the end of a migration run costs nothing;
-- keep this as the last migration file by timestamp, or append the same
-- statement to any later migration that adds a table or a foreign key.
notify pgrst, 'reload schema';
