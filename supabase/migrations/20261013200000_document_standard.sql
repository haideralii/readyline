-- REQ-016 batch 33 (D-540): the generation log records why a section fell
-- back (kind and the rule names, never content), and a version set counts the
-- sections that carry a blank for the provider separately from the sections
-- the generator could not draft. Column additions only; grants on both tables
-- stand as written in 20261012000000_documents.sql (D-052).

alter table public.generation_log
  add column failure_kind text check (failure_kind in ('model-error', 'gate', 'truncation', 'fixture-missing')),
  add column failure_detail text check (failure_detail is null or char_length(failure_detail) <= 300);

alter table public.version_sets
  add column provider_input_section_count integer not null default 0 check (provider_input_section_count >= 0);

notify pgrst, 'reload schema';
