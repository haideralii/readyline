-- REQ-005 D-046: prompt caching. The generation log keeps the cache write and
-- read token counts of each section's last call beside the uncached input
-- count, so spend can be reconciled against the Anthropic invoice.
alter table public.generation_log
  add column cache_creation_input_tokens integer,
  add column cache_read_input_tokens integer;
