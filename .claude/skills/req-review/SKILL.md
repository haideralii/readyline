---
name: req-review
description: Independent review of a requirement (REQ) before its first build session. Use whenever a REQ reaches "ready", whenever asked to review, check, challenge or sanity-test a requirement or a spec, or when the PO asks "do we need someone to check this requirement". Reads the REQ against the repository without the PO's reasoning, writes numbered findings under six fixed headings and a verdict, and puts them in the REQ itself under "## Review" for the PO to answer in place.
---

# REQ review

You are an independent reviewer of one requirement. You are given the REQ and the repository at a named SHA, and none of the PO's reasoning. Your job is to find what would make the first session build the wrong thing, test the wrong thing, or build on something that does not exist. You do not redesign the product; you name what is untestable, contradictory, unsourced, unsafe, too expensive or unclear, and you say what would fix each one in a sentence. The PO answers every finding in the REQ, in place, before the status stays "ready" (first run: `product/qa/req-reviews/2026-10-15-req-022-023-024.md`).

## Before you write

Read the REQ whole. Then read the repository where the REQ points: every file, table, function, REQ and decision it names, and the ones it assumes (a column, a role, a table, a route). Check each claim of "already exists" against `supabase/migrations/`, `src/`, `product/requirements/` and `DECISIONS.md`; check each dated or legal claim against `product/domain/` and the official source it should cite. Note the SHA you read.

## The six headings (always all six, in this order)

1. **Testability**: every AC has a fixed input and an expected output; a fixed clock where time matters; nothing "every row green" that steady state cannot reach; every FR has at least one AC.
2. **Conflicts**: with the code as it is, with other REQs, with decisions in `DECISIONS.md`, with `CLAUDE.md` sections 4 and 5; dependencies on work that is "Not started"; references to FRs that do not exist.
3. **Domain claims**: every rule, time frame, body, fee and form against the official source; VERIFY where the REQ asserts from memory; UNVERIFIED where neither of you can reach the source.
4. **Privacy and security**: participant data (never), worker names and labels, tokens and links (entropy, expiry, scope, hashing), state-changing GETs, RLS and grants for every new table (D-052), what reaches a page, a log or an email.
5. **Scope and cost**: Dev hours against the value, CI minutes against D-2207, anything a markdown index or an existing path would do instead.
6. **Clarity**: two readings of one sentence, "every path" and "all" that mean less, words a new reader would take the wrong way.

Findings are numbered through the whole review (not per heading), each one: what the REQ says (quote it), what the repository or the source says, and the fix in one sentence.

## The verdict (last line)

`**Verdict:** Ready` / `Ready with edits` / `Not ready`, then `First three:` the three findings the PO must answer first, by number, with a clause each. "Not ready" sends the REQ back to draft; "Ready with edits" lets a delivered session stand and puts the edits in before the next one.

## Where it goes

Under a `## Review` section in the REQ itself (date, reviewer, SHA, then the six headings, then the verdict), so the PO's answers sit beside each finding; the PO changes the status line to say what changed. A run over several REQs may also be kept whole under `product/qa/req-reviews/<date>-<reqs>.md`, with the PO's decision block at the top. Decision numbers used in the REQ must not collide with `DECISIONS.md` (check the last D-number first).
