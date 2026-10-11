# Decisions log

Every assumption or choice not already fixed by [CLAUDE.md](CLAUDE.md) is
recorded here, newest at the bottom of each phase. Anything about the
standards, audit process or fees that could not be confirmed from the NDIS
Quality and Safeguards Commission's own site is tagged `UNVERIFIED`.

Format: id, date, decision, why, how to revisit.

## Phase 0: scaffold (2026-10-11)

**D-001 Package manager: npm.** pnpm is not installed on the dev machine and
npm 10 ships with Node. Lockfile is `package-lock.json`. Revisit only if
install time becomes a problem.

**D-002 Node version.** Next 16 requires Node 20.9 or later. `.nvmrc` and CI
pin Node 22 (LTS). Local Node 25 works fine; CI is the reference environment.

**D-003 Next.js 16.4 with Cache Components on.** `create-next-app` now defaults
to `cacheComponents: true` and `partialPrefetching: true`, and the docs say both
become mandatory in the next major. Kept on. Consequence for later phases:
anything that reads cookies, headers, auth state or the database at request
time must sit under a `<Suspense>` boundary or inside `use cache`, otherwise
the build fails. The version-matched docs live in `node_modules/next/dist/docs/`
and must be consulted before writing routing or data code; APIs differ from
older Next. Revisit if this slows Phase 2 noticeably; turning it off is a
one-line change.

**D-004 Tailwind v4 via the Turbopack loader.** Scaffold default. No PostCSS
config file. Prettier runs with `prettier-plugin-tailwindcss` for class order.

**D-005 Test runners.** Vitest with jsdom and Testing Library for unit and
snapshot tests (`src/**/*.test.ts(x)`, `data/**/*.test.ts`). Playwright for
end-to-end in `e2e/`, Chromium only, two projects: Desktop Chrome and a
360x740 "budget Android" viewport with touch and a mobile UA. Firefox and
WebKit are excluded to keep CI under a few minutes; add them before launch if
analytics show meaningful Safari traffic.

**D-006 One CI job.** Lint, Prettier check, typecheck (`next typegen` then
`tsc --noEmit`, because the generated `LayoutProps`/`PageProps` types do not
exist until typegen runs), unit tests, production build, then Playwright
against `next start`. Playwright report uploaded only on failure. Split into
parallel jobs if the run exceeds roughly ten minutes.

**D-007 Database and auth: Supabase, Sydney region (ap-southeast-2).** Chosen
over Neon because it bundles Auth (email magic link) and row-level security in
one service, which keeps the deployable count at one. Not provisioned yet;
Phase 2 creates the project. Revisit if Supabase pricing or cold starts become
an issue.

**D-008 Hosting: Vercel.** Functions region to be pinned to Sydney (`syd1`) so
compute sits next to the database. `UNVERIFIED`: whether region pinning is
available on the Hobby plan or needs Pro; confirm when deploying in Phase 4.

**D-009 Site language `en-AU`.** Australian spelling throughout the UI and
generated documents.

**D-010 Brand placeholder.** `src/lib/brand.ts` exports `BRAND`, read from
`NEXT_PUBLIC_BRAND_NAME` and falling back to `{{BRAND}}`. All copy imports the
constant rather than hard-coding a name. `isBrandNameAllowed()` rejects any
name containing "ndis" so the final choice can be unit-tested.

**D-011 Prohibited-claims checker shipped in Phase 0.** `src/lib/claims.ts`
contains deterministic regex rules for the wording banned in CLAUDE.md 4.1 and
4.3 (guaranteed outcomes, audit-proof, pass rates, "approved by", "NDIS
approved", "official NDIS", "I heart NDIS", self-description as a registered
provider). Descriptive uses of "NDIS" are allowed. From Phase 3 the generator
runs `assertNoProhibitedClaims` on every output before rendering. Rules are a
starting list and will grow.

**D-012 Footer and layout notices.** The general-information notice and AI
disclosure are rendered on every page from the shared constants, so the same
text can be dropped into generated documents in Phase 3. The footer also notes
that "NDIS" is the NDIA's trade mark used descriptively.

**D-013 Transactional email provider: not chosen.** Only `EMAIL_FROM` and
`EMAIL_PROVIDER_API_KEY` placeholders exist. Decide in Phase 5 (reminders);
candidates are Resend or Postmark, both with Australian-friendly pricing.

**D-014 Sentry deferred to Phase 4.** No SDK installed yet; env placeholders
only. There is nothing worth tracking until the payment flow exists.

**D-015 Anthropic model id not pinned.** `ANTHROPIC_MODEL` is blank in
`.env.example`. The model and prompt version are chosen in Phase 3 and
recorded in `generation_log`.

**D-016 Next.js-managed `AGENTS.md` kept and committed.** `next dev`
regenerates it; committing it keeps the tree clean and points agents at the
version-matched docs.

**D-017 npm package name `readiness-app`.** The folder name contains capital
letters, which npm rejects, so the scaffold was created in a temp folder and
moved in. The package name is internal only and will not appear in the UI.

**D-018 Scaffold assets removed.** Next.js and Vercel SVGs and the default
favicon were deleted so no third-party logo ships by accident. A brand favicon
is added once the name is chosen.

## Open questions for Haider

1. Brand name (after ASIC and IP Australia checks). Until then `{{BRAND}}`.
2. Confirm Supabase over Neon (D-007) before Phase 2 provisions a project.
3. Vercel plan, which decides whether Sydney region pinning is available (D-008).
4. Legal entity line for the footer and documents once the ABN exists.
5. Email provider for Phase 5 reminders (D-013).

## UNVERIFIED register

Items asserted in code or copy that still need a primary source.

- D-008: Vercel Hobby plan function-region pinning.
