/**
 * The "Your details" page's words (REQ-029 FR-1, FR-4, FR-6, FR-12; D-2854,
 * D-2855, D-2860, D-2879): one page where the owner types every detail the
 * documents need, once; every string a customer reads lives here so the copy
 * lint walks it (REQ-015 FR-2). The warning is the PO's, verbatim (D-2860).
 */

export const DETAILS_TITLE = "Your details";

export const DETAILS_INTRO =
  "Typed once here, filled into every document you download. Change a detail and the next download carries it.";

/** FR-12 (D-2860), verbatim. */
export const DETAILS_WARNING =
  "Your own name and details, nothing else. Never a participant's name, number, date of birth or address.";

/** FR-4: what the Approver row and the date do, said once on the page. */
export const DETAILS_APPROVER_LINE =
  "Your name and role go on the approval line of each document on the day you adopt it; the approval date fills in then too.";

/** FR-6 (D-2855): under the name and the role, here and on the account page. */
export const DETAILS_REAPPROVAL_LINE =
  "Changing this after you adopt a document asks you to re-approve it: the document gets a new version that says who approved it and when.";

export const DETAILS_READ_ONLY_HEADING = "Your business";
export const DETAILS_BUSINESS_NAME = "Business name";
export const DETAILS_ABN = "ABN";
export const DETAILS_NO_ABN = "No ABN on your account yet.";
export const DETAILS_READ_ONLY_HELP =
  "These two are written into your documents when a pack is drafted; change them on your account page.";

/** FR-1's fields in its order, each with the label and the help a support worker can answer. */
export const DETAILS_FIELDS: Record<string, { label: string; help: string }> = {
  name: {
    label: "Your name",
    help: "Goes on the approval line of every document, for example Jane Citizen.",
  },
  role: {
    label: "Your role",
    help: "For example Owner, or Director.",
  },
  "phone-or-email": {
    label: "How workers reach you",
    help: "A phone number or an email address, for example 0400 000 000.",
  },
  state: {
    label: "Your state or territory",
    help: "For example New South Wales.",
  },
  period: {
    label: "How long you keep records",
    help: "The Rules require 7 years for incident and complaint records; 7 years is the usual answer for everything else.",
  },
  location: {
    label: "Where you keep your records",
    help: "For example a locked cabinet at home, or Google Drive.",
  },
  "notice-period": {
    label: "Notice to end a service agreement",
    help: "How much notice either side gives, for example 14 days.",
  },
  "other-tool": {
    label: "Another digital tool you use",
    help: "For example a rostering app. Tick the box below if there is none.",
  },
  "allowed-use": {
    label: "What you use that tool for",
    help: "For example rostering and timesheets.",
  },
  limits: {
    label: "What that tool must never be used for",
    help: "For example participant notes.",
  },
};

/** D-2862, D-2879: the one answer that fills the three AI-appendix keys at once. */
export const DETAILS_NO_TOOL_LABEL = "I use no other digital tool";

export const DETAILS_SAVED = "Saved";
export const DETAILS_SAVING = "Saving…";
export const DETAILS_CLEARED = "Cleared; this stays a blank in your documents.";

/** SR-6: the server's refusal of brackets and control characters, in words. */
export const DETAILS_REFUSED =
  "No square brackets or special characters here; a few plain words are enough.";
export const DETAILS_TOO_LONG = "Up to 200 characters; a few words are enough.";
export const DETAILS_UNREACHABLE =
  "Could not reach the server. Check your connection and try again.";
export const DETAILS_SAVE_FAILED =
  "We could not save that just now. Try again.";

export const DETAILS_DONE_BUTTON = "Done, update my pack";
export const DETAILS_DONE_BUSY = "Updating your pack…";
export const DETAILS_DONE_LINE = (count: number) =>
  `Done. Your ${count} documents are complete.`;

/** The summary when the form has nothing left to ask. */
export const DETAILS_NOTHING_ELSE = "Nothing else to answer here.";
export const DETAILS_ALL_FILLED = "Every blank is filled in.";
export const DETAILS_COMPLETE = (count: number) =>
  `Your ${count} documents are complete.`;
export const DETAILS_ADOPT_NEXT = "Adopt them next";
export const DETAILS_BACK = "Back to the set";

/** The one-line pointer other pages carry while a detail is open (FR-1). */
export const DETAILS_OPEN_LINE = (count: number) =>
  count === 1 ? "1 detail to fill in" : `${count} details to fill in`;
export const DETAILS_BEFORE_DOWNLOAD =
  "Fill in your details first, so your files carry them.";
export const DETAILS_PAGE_LINK = "Your details page";

/** The audit log's actions for the details page (SR-3: the key is the target, never the value). */
export const DETAILS_SAVED_ACTION = "documents.details.saved";
export const DETAILS_CLEARED_ACTION = "documents.details.cleared";
export const DETAILS_REAPPROVED_ACTION = "documents.reapproved";

/** FR-6: the re-approval control on the details page. */
export const DETAILS_REAPPROVE_HEADING = "Re-approve your adopted documents";
export const DETAILS_REAPPROVE_LINE = (count: number) =>
  count === 1
    ? "1 adopted document still names the approver you had before."
    : `${count} adopted documents still name the approver you had before.`;
export const DETAILS_REAPPROVE_BUTTON = (count: number) =>
  count === 1 ? "Re-approve 1 document" : `Re-approve ${count} documents`;
export const DETAILS_REAPPROVE_QUESTION =
  "Each document gets a new version whose change log reads who approved it and when. Go ahead?";
export const DETAILS_REAPPROVE_CONFIRM = "Yes, re-approve";
export const DETAILS_REAPPROVED_LINE = (count: number) =>
  count === 1
    ? "Re-approved. 1 document has a new version."
    : `Re-approved. ${count} documents have new versions.`;
export const DETAILS_REAPPROVE_NEEDS_NAME =
  "Add your name above first; a document is approved by a named person.";

/** REQ-029 FR-9 (D-2861): the set page's sentence for a set filled before the details page existed. */
export const DETAILS_OLDER_SET =
  "This set was filled before your details page existed; to change the name in it, regenerate the section or start a new pack.";
