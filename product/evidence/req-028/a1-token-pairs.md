# REQ-028 Session A1: every token pair, before and after (AC-2, D-2802)

Measured by `tokens.test.ts`'s formula (WCAG 2.x relative luminance). "Before" is `next` b03ce46's record: the REQ-014 tokens with the dark paper #141C1B and mist #1F2A28, and no surface, rule, line, track or wash, so a pair on one of those reads "new". "After" is this branch at 1db15b3: D-2802's values with the one amended pair, `--line` #74807D / #737F7C (D-2802's #7E8785 / #6B7673 measured 2.81:1 and 2.82:1 on mist; the Dev response's item 1(c), v4). The floor is 4.5 for text, 3 for UI parts and large text, 1.4 for a rule that must still be seen (the PO's floor, not a WCAG one). D-2802's ladder gains one line (PO 09:10): ink is a background in one place only, the inverted surface, with paper on it.

| Pair | Use | Floor | Light before | Light after | Dark before | Dark after |
| --- | --- | --- | --- | --- | --- | --- |
| ink on paper | body text on the page | 4.5 | 13.29 | 13.29 | 14.85 | 13.61 |
| slate on paper | secondary text on the page | 4.5 | 6.99 | 6.99 | 9.34 | 8.56 |
| ink on mist | text on cards and notices | 4.5 | 11.20 | 11.20 | 12.67 | 11.36 |
| slate on mist | secondary text on cards | 4.5 | 5.89 | 5.89 | 7.97 | 7.14 |
| ochre on paper | accent text and links on the page | 4.5 | 4.95 | 4.95 | 5.55 | 5.08 |
| moss on paper | ready and success text | 4.5 | 5.69 | 5.69 | 7.89 | 7.23 |
| signal on paper | error text | 4.5 | 6.89 | 6.89 | 5.97 | 5.47 |
| paper on ochre | primary button label | 4.5 | 4.95 | 4.95 | 5.55 | 5.08 |
| paper on ink | inverted surfaces | 4.5 | 13.29 | 13.29 | 14.85 | 13.61 |
| ink on sky | text on info backgrounds | 4.5 | 11.71 | 11.71 | 11.45 | 11.45 |
| ochre on mist | the ready line on its track | 3 | 4.17 | 4.17 | 4.73 | 4.24 |
| moss on mist | the done segment on its track | 3 | 4.79 | 4.79 | 6.73 | 6.04 |
| ochre on paper | focus ring | 3 | 4.95 | 4.95 | 5.55 | 5.08 |
| ink on surface | body text on a card | 4.5 | new | 14.47 | new | 12.19 |
| slate on surface | helper text on a card | 4.5 | new | 7.61 | new | 7.66 |
| ink on sky | body text on an info surface | 4.5 | 11.71 | 11.71 | 11.45 | 11.45 |
| slate on sky | helper text on an info surface | 4.5 | 6.16 | 6.16 | 7.20 | 7.20 |
| ink on signal-wash | body text in the error summary | 4.5 | new | 11.91 | new | 13.16 |
| slate on signal-wash | helper text in the error summary | 4.5 | new | 6.26 | new | 8.27 |
| ink on ochre-wash | body text in a note | 4.5 | new | 12.09 | new | 11.73 |
| slate on ochre-wash | helper text in a note | 4.5 | new | 6.36 | new | 7.37 |
| ochre on surface | accent text and links on a card | 4.5 | new | 5.39 | new | 4.55 |
| moss on surface | done text on a card | 4.5 | new | 6.19 | new | 6.47 |
| signal on surface | error text on a card | 4.5 | new | 7.50 | new | 4.90 |
| signal on signal-wash | the error summary's text | 4.5 | new | 6.17 | new | 5.29 |
| line on paper | a control's border on the page | 3 | new | 3.70 | new | 3.82 |
| line on surface | a control's border on a card | 3 | new | 4.03 | new | 3.42 |
| line on mist | a control's border on a notice | 3 | new | 3.12 | new | 3.19 |
| ochre on track | the ready line's still-to-do segment | 3 | new | 3.26 | new | 3.22 |
| moss on track | the ready line's done segment | 3 | new | 3.75 | new | 4.59 |
| rule on paper | a decoration line on the page | 1.4 | new | 1.44 | new | 1.47 |

Every "after" cell meets its floor (the test fails otherwise). Bold would mark a miss.

## The tokens

| Token | Light before | Light after | Dark before | Dark after |
| --- | --- | --- | --- | --- |
| paper | #F7F3EC | #F7F3EC | #141C1B | #1B2422 |
| mist | #E6E0D6 | #E6E0D6 | #1F2A28 | #27322F |
| ink | #1C2B2A | #1C2B2A | #F1EDE6 | #F1EDE6 |
| slate | #4A5553 | #4A5553 | #B8C0BD | #B8C0BD |
| ochre | #B4461F | #B4461F | #E0734A | #E0734A |
| moss | #2F6B4F | #2F6B4F | #6FBF95 | #6FBF95 |
| signal | #9A2B2B | #9A2B2B | #E07A7A | #E07A7A |
| sky | #DCE8E6 | #DCE8E6 | #1E3330 | #1E3330 |
| surface | new | #FFFDF9 | new | #222D2A |
| rule | new | #D4CCBF | new | #34403D |
| line | new | #74807D | new | #737F7C |
| track | new | #CFC7B9 | new | #3A4442 |
| signal-wash | new | #F3E4E2 | new | #33201F |
| ochre-wash | new | #F6E6DC | new | #3A2A22 |
