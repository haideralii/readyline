-- Operator script: grant the platform admin role (REQ-004 FR-7, D-402).
--
-- Run ONCE by the operator (Haider) in the Supabase SQL editor after the
-- admin user has signed in for the first time, so the public.users row exists.
-- The trigger users_protect_platform_admin blocks this change through the API
-- (any request carrying JWT claims); the SQL editor runs as an operator
-- session without those claims, which is the only path that works.
--
-- Replace :email with the admin's sign-in address in single quotes, for
-- example 'haider@example.com'. The address is lower-cased and hashed here
-- exactly as the auth trigger hashes it (SHA-256 of the lower-cased email),
-- so the email itself is never stored in public.users.
--
-- Afterwards the admin opens /admin, enrols a TOTP authenticator and verifies
-- it; TOTP must be enabled in Authentication > Multi-factor settings first.

update public.users
set platform_admin = true
where email_hash = encode(sha256(convert_to(lower(:email), 'UTF8')), 'hex');

-- Check: exactly one row should be returned.
select id, platform_admin, created_at
from public.users
where email_hash = encode(sha256(convert_to(lower(:email), 'UTF8')), 'hex');
