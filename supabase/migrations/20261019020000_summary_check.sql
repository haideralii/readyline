-- REQ-033 Session C (FR-C1, FR-C2; D-2977, D-2978): a version whose tailored
-- section was replaced or re-generated while the document carries the plain
-- words summary records which section changed and when; the control register
-- reads it as "Summary to check". The two ways out null the columns ("The
-- summary is still right", in place) or make a new version with them null
-- ("Redraft the summary"). Adoption is untouched (D-2977).
alter table public.document_versions
  add column if not exists summary_check_section_id text null
    check (summary_check_section_id is null or summary_check_section_id ~ '^[a-z0-9.-]{1,60}$'),
  add column if not exists summary_check_on date null,
  add constraint document_versions_summary_check_pair
    check ((summary_check_section_id is null) = (summary_check_on is null));
