# First sign-in on the deployed site, and the admin authenticator (REQ-010, batch 22)

For Haider, five steps, with what "it worked" looks like each time. No
values in this file.

1. **Request the link.** Open `https://<domain>/sign-in`, type your plain
   Gmail address, press **Email me a sign-in link**. _It worked when:_ the
   form is replaced by the grey box "If that address can sign in, a link is
   on its way. Check your inbox and spam folder. The link works once and
   expires in an hour; open it on any device." (The wording is the same
   whether or not the address exists; that is deliberate.)

2. **Open the link, on any device.** The email comes from the Readyline
   sender set up in Supabase (Resend). Tap the button. _It worked when:_
   the browser lands on `https://<domain>/account/setup` the first time
   (the "About your business" form) or on `/account` afterwards. If it
   lands on `/sign-in?error=link` the link was used already or expired:
   request another. If it lands on a Supabase error page, the redirect list
   in `DEPLOY.md` step 5 is wrong (it needs the trailing `*`).

3. **Create the account.** Fill in trading name, structure and states (ABN
   optional) and save. _It worked when:_ `/account` shows "Signed in as the
   owner of <your trading name>" with the Business details, Sessions, Your
   data, Purchases and Delete sections. The header now shows Checklist,
   Documents and Account.

4. **Become the platform admin (once).** In the Supabase dashboard open
   SQL Editor, paste `supabase/ops/grant-platform-admin.sql`, replace
   `:email` with your sign-in address in single quotes (lower case) in both
   places, run it. _It worked when:_ the final `select` returns exactly one
   row with `platform_admin = true`. Also check Authentication →
   Multi-factor that TOTP is enabled.

5. **Set up the authenticator.** Open `https://<domain>/admin`. _It worked
   when:_ you are sent to `/admin/mfa` with the heading "Authenticator
   check" and the text "Admin pages need a second factor. Scan the code
   with an authenticator app, then enter the 6-digit code it shows." Scan
   the square with Google Authenticator, Authy or 1Password, type the
   current six digits, press **Continue**. You land on `/admin` with the
   heading "Admin", the line "Signed in with a verified authenticator",
   three count boxes (Live accounts, Deleted awaiting purge, Users) and the
   recent audit log, where the first row is `admin.viewed`. From now on
   `/admin` asks for the six digits once per session.

If step 5 says the code is wrong, the phone's clock is off by more than
30 seconds; fix the time and try again. If `/admin` answers "Not found"
after step 4, sign out and in again so the new role is read.
