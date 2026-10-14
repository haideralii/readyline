# Role reviews

Seven roles review one release in order, each with its own skill loaded and its own file: QA, product manager, field specialist, NDIS domain expert, NDIS provider, NDIS auditor, NDIS Commission (`.claude/skills/role-review-pipeline`).
Each role reads the same artefacts (the rendered sole-trader pack, a pack from a test account where the environment allows, the live journey on a phone, the registers with a row entered), writes findings in its own severity scale, says where it disagrees with an earlier role, and ends with what it checked and found clean.
The PO reads the seven files, dedupes across roles and writes one batch in `product/NEXT.md` with the role tag kept on each item; the pipeline runs before every phase gate, before a trial, and after any batch that changes the generator, the fixed text or the guided path.

## Runs

| Date | SHA | Environment | QA (blocker / major / minor) | Manager (blocker / major / minor) | Field (could not / would get it wrong / annoying) | Domain (wrong / unsourced / imprecise) | Provider (could not / would get it wrong / annoying) | Auditor (major NC / minor NC / observation) | Commission (would act / would ask / would note) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-14 | `req-010-performance-budget` 5209a5e | Local dev server against the hosted project (no local stack; purchase and generation blocked by missing migrations); fresh fixture render of the sole-trader pack; desktop and Android journeys with one incident entered; iPhone journey stopped at the incident submit | 1 / 6 / 6 | 1 / 4 / 6 | 0 / 5 / 7 | 0 / 2 / 8 | 2 / 5 / 6 | 2 / 7 / 5 | 0 / 11 / 8 |

Files: `2026-10-14/qa.md`, `product-manager.md`, `field-specialist.md`, `ndis-domain-expert.md`, `ndis-provider.md`, `ndis-auditor.md`, `ndis-commission.md`.
