# Live QA of b340ee3, batch A: the eight defects, three copy items, and the acceptance reads of REQ-022 B and REQ-024 B and C

Branch `qa-live-20261018-a` from `next` 22ae46a, into `next`. Dev-1, 18 Oct 2026. The PO's QA pass is `product/qa/live-tests/2026-10-18-b340ee3/` on `main`; the rulings are the PO's 08:25 and 08:55 CHAT entries (D-2836 to D-2848).

## The defects (report C, in the README's order), one commit each with its test

| Defect | Commit | What changed | Test |
| --- | --- | --- | --- |
| D1 high, the error summary stole focus on every cleared entry | 4ca10fd, 8eb302b | The five steps count their submits; the summary focuses once per attempt, at the render that has that attempt's errors, never on a shrink | `e2e/qa-live-a.spec.ts` D1 on three projects |
| D2, "Keep" left focus on the body | 5cf52c4 | The confirm button focuses its own button again after "Keep" | `qa-live-a.spec.ts` D2 |
| D3, the pricing cards overflowed at 200 % | 54c9a7d | `min-w-0` and overflow-wrap on the card | `e2e/qa-live-zoom.spec.ts` at 360 and 320 (desktop-chromium) |
| D4, the stepper's circles overlapped at 150 % and 200 % | f5a189f, 8eb302b | Shrink, not wrap: the circle is the smaller of 2.75 rem and a sixth of the row (the viewport less the two gutters, which scale too); 44 px at 360 and 100 %, 49 px at 360 and 200 %, 43 px at 320 and 200 % | zoom spec, six circles side by side |
| D5 and D6, fieldsets and category headings scrolled sideways at 320 | 2799704 | `min-w-0` on the three fieldsets; the category heading's text wraps anywhere | zoom spec on `/start/supports` |
| D7, source links said nothing about the new tab | 6807011 | Each link carries "(opens in a new tab)" as the guides do; `req-025.spec.ts` asserted the opposite and now asserts the name | `qa-live-a.spec.ts` D7 |
| D8, a form left disabled in silence | 8c389ff, 639439c | The loading state gets "Still loading. Reload the page if this stays." after five seconds (a component test with fake timers); the component lives in `fields.tsx`, since the copy lint's file list is Dev-2's this round | `loading-note.test.tsx` |

Copy items in this branch's files (e66188a): the pack card's heading is "Document pack"; the result's "if you already bought the pack"; "Back to your result" on every step while a result exists; "Start again" clears `readyline.result.open`; the two "N of 15" comments read 16.

## The acceptance reads (PO 08:55), one commit each

| Decision | Commit | What changed |
| --- | --- | --- |
| D-2836 | db8d074 | `/account` "Reminder emails": off since the day, one button that turns them back on (`email.reminders-resumed`), or on; integration case on the row, one signed-in e2e case |
| D-2837 | 741c03c | SMTP `connectionTimeout` 10 s, `greetingTimeout` 10 s, `socketTimeout` 30 s, asserted on the transport's options |
| D-2839 | 2b5d589 and 7799878 | The switchboard's row reads "Test email sent <date, time Sydney>", never expiring |
| D-2840, D-2847 | aae016d | `20261017150000_qa_live_a.sql`: `worker_ensure_items` refuses an id outside the closed list and takes the owner role from the owner's own setting; the supervision delete policy is a 24-hour window; integration cases |
| D-2841 | 988d15e and eb4039c | A failed test send writes `email.test-failed` (the error's class or code, no message); the minute limit reads either line; the log carries the code, not the message |
| D-2842 | e13ef80 | Every DNS error path reads unverified |
| D-2844 | c0187a9 | D-2277's "how to revisit" sentence |
| D-2845 | efa480a | Both ticks show with their actors' roles; the owner's confirm is one function the page and the integration test share |
| Item 14 | 876a69c | D-2816 to D-2848 copied into `DECISIONS.md` in the log's form; the longest D-2282 kept |

D-2838 and D-2848 need no code here; D-2843 and D-2846 are REQ text amendments on `main` (60398f0). Also in the branch: f9eb0af and 4d6ae27 (the zoom spec's typed skip; the D1 spec taps the field for WebKit's phone emulation), 8801079 (PO 12:08: `TextInput` takes a `type`; the eight other `ErrorSummary` forms focus the summary when it appears, never on a shrink), and eb4039c (the failed-send action name beside the sent one; the sign-in form left as `next` has it until Dev-2's branch is under the merge of `next`, when the field moves onto the shared control with `type="email"`).

Head: 876a69c.

## Verification

- `npm run check` green at every push; a production build from the main tree with the touched public specs on the three projects at the first push (D1 to D8 and the copy), and with the public smoke at the second.
- The integration tests and the signed-in spec run on the PR's Supabase job alone (the standing rule).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
