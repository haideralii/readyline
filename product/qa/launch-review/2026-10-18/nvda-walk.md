# Screen-reader walk, NVDA on Windows (REQ-012 FR-3c; REQ-015 FR-18; D-2904)

Walked by: the PO (role). Browser: Firefox or Chrome, NVDA in browse mode, the production build or the live site after launch. Level: WCAG 2.2 AA (D-2912). Fill the last column with what you heard, in your own words; a blank row is "not walked yet". A line that does not match "should announce" is a finding for the REQ's PO review (D-2222 for any wording change). Nothing here names a person; use the fixture account or your own test account.

Keys: `Tab` and `Shift+Tab` move between controls; `H` jumps by heading; `D` by landmark; `Insert+Space` toggles browse and focus mode; `Insert+T` reads the page title.

| # | Page | Steps | Should announce | Heard |
| --- | --- | --- | --- | --- |
| 1 | `/` | `Insert+T`; `H` through the headings; `D` through the landmarks | The title names the site and the page; one level-1 heading, then the section headings in order; banner, main, contentinfo landmarks; the skip link first on `Tab` | |
| 2 | `/` | `Tab` to the first call to action and press `Enter` | "Start, link" (or the button's own words) and the questionnaire opens with its heading read | |
| 3 | `/start` intro | `Tab` through the page | Each control by its label; the one primary button last; no unlabelled control, no "clickable" | |
| 4 | `/start/business` | `Tab` into the first question; `Up`/`Down` through the options; `Space` to choose | The question as the group's name, then each option by its label and "radio button, not checked", then "checked" on the choice; the hint read once, not per option | |
| 5 | `/start/business` | Choose, then `Tab` to Next and `Enter` | "Next, button"; the new step's level-1 heading read on arrival (focus moves to it) | |
| 6 | `/start/supports` | `Tab` into the checkbox list; `Space` on two | Each option by label and "checkbox, not checked"; "checked" after `Space`; the count or summary line read if present | |
| 7 | Any step, leave a required question empty and press Next | The error summary announced (heading or alert) and the first error link; `Enter` on it lands on the field, which reads its label and the error text | |
| 8 | `/start/result` | `H` through the headings; `Tab` through the links | The result's heading first (modules and the audit pathway in words); every link by a name that says where it goes; no two links with the same name going to different places | |
| 9 | `/sign-in` | `Tab` to the email field, type, `Tab` to the button, `Enter` | "Email, edit, required"; the button's words; the sent state announced (a status or alert) | |
| 10 | `/checklist` | `H` through the groups; `Tab` into one item's status control; change it | Group headings; each item's status by label and state; the change announced (status region) | |
| 11 | `/documents` | `Tab` through the set's documents | Each document by title and state; the download control by name; the Start here sheet first | |
| 12 | `/account` | `Tab` through the forms | Each field by label; the registration period's dates by label; the team panel's invite control; the delete control named plainly with its confirmation | |
| 13 | `/registers` | `Tab` through the register list | Each register by name with its count or state; the "add" control per register by name | |
| 14 | `/registers/incidents/new` | `Tab` through the form; leave a required field empty; submit | Every field by label and whether required; the participant-reference hint read once; on submit the error summary first, then the field with its error | |
| 15 | `/registers/incidents/new` | Fill the form with the keyboard and save | "Saved" or the new row announced; focus lands on the heading or the row, not the top of the page | |
| 16 | `/worker` (a worker account) | `H` and `Tab` through the home | The worker's steps as a list with each step's state; the two forms' links by name; nothing of the manager's registers | |
| 17 | Any page, dark scheme | Repeat 1 and 14 with the system in dark mode | No difference in what is read (colour carries no meaning alone) | |

Findings: list each as `#row: what was heard, what should have been` below; they go to the REQ's PO review.

- 
