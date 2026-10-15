-- Batch 45, REQ-018-gated item: the notification reference on the incident
-- row. When a reportable incident is notified, the Commission answers with a
-- reference; the register keeps it beside the date it was told, so the row
-- an auditor samples carries both. Optional, short, letters and digits only;
-- never a name and never an NDIS participant number (the CHECK keeps that
-- shape out). Row-level security and the grants of the table are unchanged.
alter table public.incidents
  add column commission_reference text not null default ''
    check (
      char_length(commission_reference) <= 40
      and commission_reference ~ '^[A-Za-z0-9 /-]*$'
      and not public.looks_like_ndis_number(commission_reference)
    );
