# Pull request: batch 46, the release flow on free tiers (D-2205, D-2206, D-2207)

Base: `next`. Head: `batch-46-release-flow`. Compare link: https://github.com/haideralii/readyline/compare/next...batch-46-release-flow?expand=1

Title: `Batch 46: the release flow on free tiers (next branch, docs-only commits cost nothing, limits written down)`

---

## REQ

Batch 46 (`product/NEXT.md`, "## Batch 46"): D-2205, D-2206 and D-2207, the three release-flow items Haider asked for after today's 21 merges hit Vercel Hobby's deployment limit. No REQ; the PO's decisions are the specification.

Base branch: `next` (D-2205), the first pull request to target it.

## What changed

1. D-2205: `next` exists on the remote, cut from `main` at 01ad5bc. The pull request template says every pull request targets `next` and names the one exception.
2. D-2206: `ci.yml`'s `push` trigger on `main` ignores `product/**` and `**/*.md`; the `pull_request` trigger is unchanged. `scripts/ops/vercel-ignore-build.sh` is the Ignored Build Step: exit 0 (skip) unless the ref is `main` and `git diff --quiet HEAD^ HEAD -- . ':(exclude)product' ':(exclude)*.md'` reports a change; a root commit or a clone without the parent builds. `scripts/ops/vercel-ignore-build.test.ts` runs the script against real commits in a throwaway repository (root commit builds; product/, DECISIONS.md and a deep markdown file skip; a code change builds, also beside a markdown change; any ref but `main` skips). The runbook's section 2 tells Haider what to paste.
3. D-2207: `supabase/ops/DEPLOY.md` gains "Limits (the free tiers)": Vercel Hobby, GitHub Actions, Supabase Free and Stripe test mode, each with what we do about it, and the rule that anything pushing against a limit is said in CHAT first.

## Security checklist (REQ-002 FR-7; tick or explain)

- [x] No route handler or server action changed.
- [x] No secrets, tokens or `.env` files in the diff; no new environment variable (the script reads Vercel's own `VERCEL_GIT_COMMIT_REF`).
- [x] No log change.
- [x] Security headers and CSP unchanged.
- [x] No new external origin; no new dependency.
- [x] No customer or participant data anywhere in the change.
- [x] CI: `paths-ignore` applies to the `push` trigger on `main` only, so every pull request still runs every job; the secret scan workflow is untouched and still runs on every push.

## Tests and evidence

- `npm run check`: green on the branch head (the new test file adds four tests; locally they run through Git for Windows' bash).
- The CI run on the pull request (public window).
- Not changed: anything under `src/`.

## Claims, brand, privacy

- [x] Nothing customer-facing changed.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
