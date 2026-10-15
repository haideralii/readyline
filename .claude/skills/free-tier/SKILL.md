---
name: free-tier
description: The free-tier limits every service in this project runs on (Vercel Hobby, GitHub Actions, Supabase Free, Stripe test mode), with the numbers, their sources and read dates, and the working rules that keep a day's work inside them. Use this before any push, merge, forward merge, CI re-run, deploy or release, whenever a chain of branches is being merged forward, when a check reads "rate limited", when planning how many PRs to open, or when anyone asks "will this hit a limit", "how many deploys do we have left" or "why did Vercel refuse".
---

# Free tiers (the standing constraint, D-2207 and D-2239)

Every service is on a free tier until the product earns its way off them. The limits are not background: they decide how work reaches `main`. Anything that would push against one of them is said in `product/CHAT.md` before it is done, by the PO or by Dev.

## The numbers (with the page that says so; re-read the page when it is older than three months)

| Service        | Limit                                                                                                              | Source and read date                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Vercel Hobby   | 100 deployments created a day; 100 an hour; 60 in any five minutes; one concurrent build; 100 GB bandwidth a month | vercel.com/docs/limits, "Deployments Created per Day" and the rate-limit table; page dated 16 Sep 2026, read 16 Oct 2026 |
| Vercel Hobby   | A build the Ignored Build Step cancels is still a created deployment and counts toward the daily quota             | vercel.com/docs/project-configuration/project-settings, "Ignored Build Step" note; read 16 Oct 2026                      |
| GitHub Actions | 2,000 minutes a month while the repository is private; a full CI run here is about 45 job minutes                  | D-2207 (GitHub's plan page, not re-read tonight)                                                                         |
| Supabase Free  | Two projects; a project pauses after 7 idle days                                                                   | D-2207                                                                                                                   |
| Stripe         | Test mode only until the launch pass (D-2202)                                                                      | REQ-022                                                                                                                  |

## What spends a Vercel deployment

- Every push to a branch Vercel is allowed to deploy creates one deployment, whether or not it builds. With `vercel.json`'s `git.deploymentEnabled` set to every branch `false` and `main` `true` (D-2239), only a commit on `main` creates one; the Ignored Build Step then skips docs-only commits on `main` (D-2206), and that skip still counts as one.
- A merge of `next` into `main` is one deployment; a docs-only commit on `main` is one (cancelled, counted). Budget: one or two merges to `main` a day (D-2205), a handful of docs commits, and nothing else.
- UNVERIFIED (the docs do not say): which commit's `vercel.json` Vercel reads for `deploymentEnabled`. Until D-2239 is on `main`, assume every branch push still deploys.

## Working rules

1. **Forward-merge a chain once, after the last fix, not after every fix.** On 15 to 16 Oct a chain of six branches was re-merged after each of five fixes to the first branch: about forty pushes, each a preview deployment, and the cap was spent before the release. Fix on the branch, let its CI run, and when the PO says it is green, merge forward once in order.
2. **PRs to `next` one or two at a time.** Each open PR's run is about 45 GitHub minutes and, until D-2239 is live, one deployment per push; a stack of eleven PRs pushed in one evening is what the limits refuse.
3. **No re-run of a red job without reading its trace or annotations first** (D-2207); `cancel-in-progress` stays on.
4. **Docs go straight to `main` as docs-only commits** (`paths-ignore` runs no CI; the Ignored Build Step builds nothing), but each is still a counted deployment: batch the day's status, chat and decision commits where the protocol allows.
5. **Say it first.** Anything that will push against a limit (a long chain, a day with more than one release, a Supabase project idle for a week) goes in `product/CHAT.md` before it is done.
6. **When a check reads "rate limited"**: nothing is broken; the day's quota is spent. Do not retry; note the time, and the PRs wait for the window to pass (24 hours from the first refused deployment) or for Haider's morning.

Related: `supabase/ops/DEPLOY.md` "Limits (the free tiers)", `release-gate` (the pre-ship checklist), D-2205 to D-2207, D-2239.
