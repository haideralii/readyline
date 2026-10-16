/**
 * Retro review of REQ-013 to 017, finding 114 (D-2244): "adopted" is
 * approval by a named person on a date, so step 5 refuses until the
 * account's name fact is set; the document control register's "by whom"
 * then names that person. The one-line reason and the link the screen and
 * the action both use.
 */
export const ADOPT_NEEDS_NAME = "Type your name on the account page first.";
export const ADOPT_NEEDS_NAME_HREF = "/account#ownerName";
export const ADOPT_NEEDS_NAME_LINK = "Go to your account page";
