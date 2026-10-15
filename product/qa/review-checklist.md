# PO review checklist (used on every delivery)

## Requirement fit
- Does the delivered behaviour match each AC literally? Try the negative and boundary cases listed in the REQ and a few the REQ did not list.
- Anything built that was out of scope? Flag it; scope creep is removed or moved to backlog.

## Domain correctness
- Any regulatory statement: is it sourced with URL and date in code or data? Spot-check two against the Commission's site.
- Terminology: participant / worker / provider; Australian spelling; plain English.
- Would a small provider understand the screen without help? Read it as a tired sole trader on a phone.

## Security and privacy
- Walk the threat model controls relevant to this REQ; demand the named evidence.
- Try the obvious abuses: another account's ID in the URL, oversized input, prompt-injection text in a free field, replaying a webhook, hitting rate limits.
- Any new place participant data could be entered? Warning present? Field excluded from AI prompts and logs?

## Quality
- Tests actually assert behaviour (not just "renders"). Snapshot tests are reviewed, not auto-accepted.
- Every form the change adds or touches that a customer submits has an e2e that submits it through the real handler on all three projects (definition of done, item 11); name the spec.
- Error states and empty states exist and are humane.
- Performance on the budget-Android project: interactive quickly, no layout shift.

## Claims, brand, legal
- Run the claims checker over new copy; read it anyway for softer overclaims ("ensures", "compliant", "approved").
- `{{BRAND}}` only; no NDIS logo or name-as-brand; general-information notice where documents are shown or downloaded.

## Decision hygiene
- `DECISIONS.md` updated; `UNVERIFIED` items listed; open questions phrased as options.

Outcome written in the REQ under **PO review**: `Accepted` or `Changes requested` with numbered items, each tied to an AC, SR or checklist line.
