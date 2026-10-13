# UI copy: what we say to the customer

Owner: PO. Dev draft of 13 October 2026 (REQ-015 FR-1) for the PO to own. Kept apart from `house-style.md` because that file is read verbatim into the generator's system prompt and must stay about the documents.

The customer is a support worker on a phone, often tired, who needs the answer and one next step. Every page, card and message passes the "tired person on a bus" test.

- **Answer first.** The first sentence of a page or card is the answer or the action, never the background. "Your audit: certification." before anything about how we worked it out.
- **Short.** Sentences average under 20 words and never pass 30. A paragraph is at most 3 lines on a 375 px screen, about 45 words. One idea per sentence.
- **Everyday words.** Use, start, tell, help, need, have. Never: leverage, utilise, in order to, pursuant, N/A. Say "you" and "your"; "the provider" only when quoting the Commission.
- **Code after the name.** A class or clause number follows its plain name, in secondary text: "Household tasks 0120", not "0120 Household tasks". Numbers as numerals.
- **No internal names.** No file path, file name or system term ever reaches the customer. A source line names the fact ("Every registered provider needs this"), not where we keep it.
- **Active voice, present tense.** "We email you a link", not "A link will be sent".
- **One primary action per screen**, named by what it does: "See which audit I need", "Open your checklist".
- **Feedback in words.** A tap shows its result in words within a moment: "Saved", "Not saved, try again", "Loading". Colour and icons support the words, never replace them.

The lint in `tests/copy-lint.test.ts` enforces the hard limits (60-word paragraph, 35-word sentence, banned words, internal paths) over every page, copy module and content file the customer sees.
