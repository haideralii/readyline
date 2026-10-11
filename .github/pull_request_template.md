## REQ

REQ-nnn: <title> (link to `product/requirements/REQ-nnn-*.md`)

## What changed

-

## Security checklist (REQ-002 FR-7; tick or explain)

- [ ] Every new or changed route handler and server action parses input with `parseInput` and a `strictObject` schema; free text is length-capped.
- [ ] No secrets, tokens or `.env` files in the diff; new env variables are in `.env.example` with where they live in production.
- [ ] Logs go through `@/lib/logging` and contain no emails, tokens, free text or participant-like data.
- [ ] Security headers and CSP unchanged, or the change is justified here and recorded in `DECISIONS.md`.
- [ ] No new external origin for scripts, styles, fonts, images or connections, or it is listed in the CSP and `DECISIONS.md`.
- [ ] New dependencies are justified in one line each and `npm audit --omit=dev --audit-level=high` is clean.
- [ ] Any new free-text field that could receive participant details carries the inline warning and is excluded from prompts, emails and logs.
- [ ] Tenant data changes keep row-level security and the cross-tenant test green (from REQ-004).

## Tests and evidence

- `npm run check`:
- `npm run test:e2e`:
- Screenshots at 360px and desktop (UI changes):
- Delivery evidence section in the REQ updated: yes / no

## Claims, brand, privacy

- [ ] New copy passed `findProhibitedClaims`; `{{BRAND}}` placeholder used; Australian spelling.
