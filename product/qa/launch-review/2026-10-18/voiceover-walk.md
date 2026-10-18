# Screen-reader walk, VoiceOver on iPhone (REQ-012 FR-3c; REQ-015 FR-18; D-2904)

Walked by: the founder (role). Safari on iPhone, VoiceOver on, the production build or the live site after launch; Settings, Accessibility, Display, text at the largest non-accessibility size for rows marked "large text". Level: WCAG 2.2 AA (D-2912). Fill the last column with what you heard; a blank row is "not walked yet". A line that does not match "should announce" is a finding for the REQ's PO review (D-2222 for any wording change). Nothing here names a person; use the fixture account or your own test account.

Gestures: swipe right and left move between elements; double-tap activates; the rotor (two-finger twist) set to Headings or Landmarks jumps by heading or landmark; a two-finger swipe up reads from the top.

| # | Page | Steps | Should announce | Heard |
| --- | --- | --- | --- | --- |
| 1 | `/` | Two-finger swipe up; rotor to Headings, swipe down | The page read in order: the heading first, each section's heading, the primary action; landmarks banner, main, footer | |
| 2 | `/` | Swipe to the first call to action and double-tap | "Start, link" (or the button's own words) and the questionnaire's heading read on arrival | |
| 3 | `/start/business` | Swipe through the question's options; double-tap one | The question read as the group's name once; each option by label with "radio button" and its state; "selected" after the double-tap | |
| 4 | `/start/business`, large text | Repeat 3 with the largest text | The same order; nothing cut off; no sideways scroll | |
| 5 | `/start/supports` | Swipe through the checkbox list; double-tap two | Each option by label and "checkbox, not checked"; "checked" after each double-tap | |
| 6 | Any step, leave a required question empty and double-tap Next | The error summary read (an alert or the heading), then the first error; double-tap it and the field reads its label and the error | |
| 7 | `/start/result` | Rotor to Headings; swipe through the links | The result's heading first; every link by a name that says where it goes | |
| 8 | `/sign-in` | Swipe to the email field, type, swipe to the button, double-tap | "Email, text field, required"; the button's words; the sent state announced | |
| 9 | `/checklist` | Rotor to Headings; swipe into one item and change its status | Group headings; each item's status by label and state; the change announced | |
| 10 | `/documents` | Swipe through the set | Each document by title and state; the download control by name; the Start here sheet first | |
| 11 | `/account` | Swipe through the forms | Each field by label; the registration period's dates by label; the invite control; the delete control named plainly | |
| 12 | `/registers/incidents/new` | Swipe through the form; submit with a required field empty | Every field by label and whether required; the participant-reference hint read once; the error summary first on submit, then the field with its error | |
| 13 | `/registers/incidents/new` | Fill and save with VoiceOver on | "Saved" or the new row announced; focus on the heading or the row, not the top | |
| 14 | `/worker` (a worker account) | Rotor to Headings; swipe through the steps | The worker's steps as a list with each state; the two forms' links by name; nothing of the manager's registers | |
| 15 | Any page, dark scheme | Repeat 1 and 12 with the phone in dark mode | No difference in what is read | |

Findings: list each as `#row: what was heard, what should have been` below; they go to the REQ's PO review.

- 
