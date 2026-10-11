# REQ-004: Accounts, authentication and tenancy
Status: ready (Dev response first; build after Haider creates the Supabase project)
Phase: 2   Priority: must   Owner: Dev

## Why
A provider needs to come back to their questionnaire, buy, download documents and keep registers over three years. That needs an account, and every later feature's security depends on tenancy being right from the first table: one provider must never see another's data.

## Scope
In: Supabase project wiring (ap-southeast-2, D-023), email magic-link sign-in, account and membership model (one account per provider business; one owner user now, members later), row-level security on every table, server-side data access only, the `DraftStore` server implementation for REQ-003, account settings (business details), data export (JSON zip) and account deletion (soft delete, purge job), session handling, admin role for Haider behind MFA.
Out: payments, registers, documents, multi-member invitations (model it, do not build the UI).

## Domain rules that apply
`CLAUDE.md` 4.5 and the threat model (identity and access, data). No participant data is stored anywhere in this REQ.

## Functional requirements
- FR-1 Sign in with email magic link only (no passwords, no social logins for now). Rate-limited: 5 requests per email per hour, 20 per IP per hour; generic success message whether or not the email exists.
- FR-2 First sign-in creates a `users` row and, after a short "about your business" step (prefilled from any local questionnaire draft), an `accounts` row with the user as `owner`. Local draft is migrated to the server draft and cleared locally (REQ-003 SR-4).
- FR-3 Tables: `users`, `accounts`, `memberships (user_id, account_id, role: owner|member)`, `questionnaire_drafts (account_id, answers jsonb, version, updated_at)`, `audit_log (account_id, actor_user_id, action, target, at)`; later REQs add theirs. Every account-scoped table has `account_id` and RLS policies that allow access only through an active membership.
- FR-4 All data access goes through server code with the user's session; the service-role key is used only in server-only modules for admin and purge jobs and is never imported by client code (lint rule or test).
- FR-5 Account settings page: trading name, structure, states, ABN; change requires re-validation with the REQ-003 schemas.
- FR-6 Export: owner can download a JSON zip of everything stored for the account within the request (sync for now). Deletion: owner can delete the account; it is soft-deleted immediately (sign-in blocked, data hidden) and purged by a scheduled job after 30 days, including storage objects; an email confirms both events.
- FR-7 Admin: a `platform_admin` flag on Haider's user only, settable only via SQL; admin routes require MFA (Supabase TOTP) and are allow-listed server-side; admin actions are written to `audit_log`.
- FR-8 Sessions: Supabase SSR cookies (HttpOnly, Secure, SameSite=Lax); sign out everywhere on password-less reset (re-issuing a magic link) is not needed, but "sign out of all devices" is.

## Security and privacy requirements
- SR-1 RLS on every table; a test signs in as two users and proves user A cannot read, update or delete user B's rows by id through any route or action.
- SR-2 CSP `connect-src` extended only to the Supabase project origin; recorded in `DECISIONS.md`.
- SR-3 Rate limiting on the magic-link endpoint and on export; limits recorded.
- SR-4 Logs never contain emails in clear (hash) or draft contents.
- SR-5 Secrets only in environment; `.env.example` documents `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only) with where each lives in production.
- SR-6 Migrations are files in the repo (`supabase/migrations`), applied by CI to a disposable test database for the RLS tests; never hand-edited in the dashboard.

## Data
As FR-3. Retention: soft delete 30 days then purge; audit log kept 2 years.

## Acceptance criteria
- AC-1 Given a new email, when a magic link is requested and followed, then a user and an owner membership exist and the user lands on the "about your business" step; given an unknown email, the UI shows the same message and no error leaks.
- AC-2 Given two accounts A and B with data, when user A requests any of B's rows by id through every route and action that exists at delivery, then the response is not found or forbidden and nothing is written (automated RLS test).
- AC-3 Given a local questionnaire draft exists, when the user signs in, then the draft is on the server, the local copy is cleared, and the questionnaire resumes at the same step.
- AC-4 Given the owner requests export, then a zip downloads containing every row for the account and nothing from any other account.
- AC-5 Given the owner deletes the account, then sign-in is refused immediately, the data is invisible to all routes, a confirmation email is sent, and the purge job (run manually in the test) removes the rows and objects.
- AC-6 Given six magic-link requests for one email in an hour, then the sixth is refused with a polite message and no email is sent.
- AC-7 Given a non-admin user, when any admin route is requested, then 404; given Haider's user without a completed MFA challenge, then the MFA step is required first.
- AC-8 Given the client bundle, then the service-role key string does not appear in it (build-time test).

## Test expectations
Integration tests against a disposable Supabase (local via the Supabase CLI in CI) for RLS, export, deletion, rate limits; e2e for sign-in and draft migration on both projects (with the email captured from the local inbox tool).

## Evidence required on delivery
CI link with the RLS suite visible; migration files; a screenshot of the Supabase project region; the `.env.example` diff; a short note on anything the Supabase CLI could not do in CI.

## Questions for Dev to answer before building
1. Supabase CLI local stack in GitHub Actions: feasible within the 20-minute budget? Propose the job layout.
2. Magic-link rate limiting: Supabase's built-in limits versus our own; recommend and state the numbers.
3. How will the purge job run (Supabase cron, Vercel cron, GitHub Actions schedule)? Recommend with the trade-off.
4. Estimate in sessions, and exactly which values Haider must supply from the Supabase dashboard (names only, never values in chat).

## Dev response
(Dev fills in.)

## Delivery evidence
(Dev fills in.)

## PO review

**11 Oct 2026, Dev response review (on `req-004-accounts`, 2c5f6de): ACCEPTED; build approved once Haider's Supabase project exists.** Decisions: own per-email and per-IP limiter in front of Supabase (accepted, with the hashed-email key); Vercel Cron purge route protected by `CRON_SECRET` (accepted); Supabase CLI local stack in CI with the integration project (accepted; if it exceeds the 20-minute budget, split into its own job). Haider will supply, by name: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; `CRON_SECRET` is generated by Dev. The REQ-003 build does not depend on these; REQ-004 Session A may start as soon as `.env.local` has them. Status: `in progress` once the build starts.
