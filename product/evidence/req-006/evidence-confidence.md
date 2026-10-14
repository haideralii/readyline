# Checklist evidence confidence (REQ-006; REQ-013 batch 36 item 2)

Some readiness checklist items are Readyline's own evidence items: the
Commission's text held in `data/standards.json` does not state the
requirement, so `deriveChecklist` flags them `unverified: true`. That flag
is internal. Since batch 36 it appears only here and on the admin page
(`/admin`, "Checklist items not confirmed by the Commission's text"); the
customer's checklist and result page show a plain sentence instead ("Check
this against the Commission's page before you rely on it") with the item's
source link, and `copy-lint` bans the phrase "not confirmed by the
Commission" from customer copy.

Items flagged as of 14 October 2026 (from `src/lib/checklist/derive.ts`):

- `people:worker-screening-clearances`: NDIS Worker Screening clearances for
  key personnel and risk-assessed roles. The Worker Screening Rules are not
  in the dataset; the evidence item is Readyline's.
- `business:insurance-workers-compensation`: workers compensation insurance
  for employers. A state or territory requirement, not a Commission one;
  auditors commonly ask for it.

The list on the admin page is computed from the three reference cases, so
it stays current when the derivation changes; this file is the PO's record.
