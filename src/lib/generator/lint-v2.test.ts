// @vitest-environment node
/**
 * House style version 2 lints (batch 40, D-544): an indicator restated as
 * a policy sentence, a vague time word without a number, "staff" as an
 * actor, and a record name the pack does not hold.
 */
import { describe, expect, it } from "vitest";
import { COMMISSION_CONTACT_STRINGS } from "./fixed-extras";
import {
  contactStringsIn,
  lintContactDetails,
  lintIndicatorRestatement,
  lintRecordNames,
  lintStaffActor,
  lintVagueTime,
} from "./lint";
import { knownRecordNames } from "./record-names";

describe("indicator restatement (v2 a)", () => {
  const indicators = [
    "Each participant is supported to make informed choices about their supports and exercise control over their life.",
    "Incidents are acknowledged, responded to, well-managed and learned from.",
  ];

  it("fails a sentence that shares 80 percent or more of its words with an indicator", () => {
    const f = lintIndicatorRestatement(
      "We make sure each participant is supported to make informed choices about their supports and to exercise control over their life.",
      indicators,
    );
    expect(f.map((x) => x.rule)).toEqual(["indicator-restatement"]);
  });

  it("passes a sentence that says what we do, which role, by when and on which record", () => {
    const f = lintIndicatorRestatement(
      "The worker on shift records each incident in the incident register before the end of the shift and tells the owner the same day.",
      indicators,
    );
    expect(f).toEqual([]);
  });

  it("ignores short sentences and empty indicator lists", () => {
    expect(
      lintIndicatorRestatement("Incidents are learned from.", indicators),
    ).toEqual([]);
    expect(lintIndicatorRestatement("Any sentence here.", [])).toEqual([]);
  });
});

describe("vague time words (v2 c)", () => {
  it("fails timely, promptly, as soon as practicable, regularly and appropriate with no number near them", () => {
    const f = lintVagueTime(
      "We respond promptly. The owner reviews the register regularly and takes appropriate action as soon as practicable.",
    );
    expect(f.map((x) => x.match.toLowerCase())).toEqual([
      "promptly",
      "regularly",
      "appropriate",
      "as soon as practicable",
    ]);
  });

  it("passes when a number sits within six words, and passes real time frames", () => {
    expect(
      lintVagueTime(
        "We respond promptly, within 24 hours. The owner reviews the register regularly, every 3 months. We tell the participant the same day.",
      ),
    ).toEqual([]);
    expect(
      lintVagueTime("Within 5 business days we write to the participant."),
    ).toEqual([]);
  });
});

describe("staff as an actor (v2 b)", () => {
  it("fails staff, the team and someone; passes the staff matrix and a class name", () => {
    const f = lintStaffActor(
      "Staff record the incident. The team reviews it. Someone tells the owner. The staff matrix shows training.",
      { allowedPhrases: ["Staff support in the home"] },
    );
    expect(f.map((x) => x.match.toLowerCase())).toEqual([
      "staff",
      "the team",
      "someone",
    ]);
    expect(
      lintStaffActor("Our Staff support in the home class is 0115.", {
        allowedPhrases: ["Staff support in the home"],
      }),
    ).toEqual([]);
  });
});

describe("record names (v2 d)", () => {
  const known = knownRecordNames();

  it("knows the Readyline registers, the catalogue documents and the pack's forms", () => {
    for (const n of [
      "incident register",
      "complaints register",
      "staff matrix",
      "record of decisions",
      "document control register",
      "consent form",
      "governance policy",
    ])
      expect(known, n).toContain(n);
  });

  it("passes known records in a sentence and fails an invented one", () => {
    expect(
      lintRecordNames(
        "The worker records it in the incident register and the owner notes the change in the record of decisions. We keep the consent form on file.",
        known,
      ),
    ).toEqual([]);
    const f = lintRecordNames(
      "The worker fills in the daily wellbeing register and the shift handover form.",
      known,
    );
    expect(f.map((x) => x.match)).toEqual([
      "daily wellbeing register",
      "shift handover form",
    ]);
  });

  it("a bare word is not a record name", () => {
    expect(lintRecordNames("We keep a register of what we do.", known)).toEqual(
      [],
    );
  });

  it("accepts only the canonical spelling and offers the fix for a known alias (batch 42, D-547)", () => {
    const f = lintRecordNames(
      "The owner adds the date to the clearance register and the gap to the risk register. The worker checks the training matrix.",
      known,
    );
    expect(f.map((x) => [x.match, x.why])).toEqual([
      [
        "clearance register",
        'write "Worker checks register", the name this pack and the Readyline registers use',
      ],
      [
        "risk register",
        'write "Corporate risk register", the name this pack and the Readyline registers use',
      ],
      [
        "training matrix",
        'write "Staff matrix", the name this pack and the Readyline registers use',
      ],
    ]);
    expect(
      lintRecordNames(
        "The owner adds the date to the worker checks register and the gap to the corporate risk register.",
        known,
      ),
    ).toEqual([]);
  });

  it("a catalogue document that ends in 'register' passes by its own title", () => {
    expect(
      lintRecordNames(
        "See the risk management policy and register for the areas we watch.",
        known,
      ),
    ).toEqual([]);
  });
});

describe("contact details (batch 42 item 1, D-546)", () => {
  it("finds phone numbers, email addresses and web addresses once each, in order", () => {
    const found = contactStringsIn(
      "Call 1800 035 544 or (02) 9999 9999, or 0412 345 678, or TTY 133 677; email jane@example.com.au or see www.example.com.au/help.",
    );
    expect(found.map((c) => [c.kind, c.value])).toEqual([
      ["phone", "1800 035 544"],
      ["phone", "(02) 9999 9999"],
      ["phone", "0412 345 678"],
      ["phone", "133 677"],
      ["email", "jane@example.com.au"],
      ["url", "www.example.com.au/help"],
    ]);
  });

  it("ignores class codes, years, section numbers and ABN-free digit runs", () => {
    expect(
      contactStringsIn(
        "Class 0115 and class 0107 apply. We adopted this in 2026, see section 4.2 and step 13 of 20. Review within 5 business days.",
      ),
    ).toEqual([]);
  });

  it("passes the Commission's details and the facts' strings, fails anything else", () => {
    const allowed = [...COMMISSION_CONTACT_STRINGS, "61 234 567 890"];
    expect(
      lintContactDetails(
        "Anyone can phone the Commission on 1800 035 544 or email contactcentre@ndiscommission.gov.au; see www.ndiscommission.gov.au. Our ABN is 61 234 567 890.",
        allowed,
      ),
    ).toEqual([]);
    const f = lintContactDetails(
      "Interpreters: call 131 450. Complain at ndiscommission.gov.au/complaints or email help@example.com.",
      allowed,
    );
    expect(f.map((x) => x.match)).toEqual([
      "131 450",
      "ndiscommission.gov.au/complaints",
      "help@example.com",
    ]);
    expect(f[0].why).toMatch(/How to contact the Commission/);
  });
});
