-- Batch 45 item 22: the worker screening check number, optional. The NDIS
-- (Practice Standards—Worker Screening) Rules 2018 s 18(3)(d) require the
-- provider's written list to hold the worker's NDIS worker screening check
-- application number and check number (compilation F2021C00788, read
-- 15 October 2026), so the register can hold it; it is never a name or an
-- NDIS participant number (the CHECK keeps the participant-number shape out).
alter table public.worker_clearances
  add column clearance_number text not null default ''
    check (
      char_length(clearance_number) <= 40
      and clearance_number ~ '^[A-Za-z0-9 /-]*$'
      and not public.looks_like_ndis_number(clearance_number)
    );
