import { describe, expect, it } from "vitest";
import { detectParticipantData } from "./participant-data";

const kinds = (text: string) => detectParticipantData(text).map((w) => w.kind);

describe("detectParticipantData", () => {
  it("is silent for ordinary service descriptions", () => {
    expect(
      kinds(
        "We provide household tasks and community access across Western Sydney for about 12 participants.",
      ),
    ).toEqual([]);
    expect(kinds("")).toEqual([]);
    expect(
      kinds(
        "Support coordination and daily living skills, mostly weekday mornings.",
      ),
    ).toEqual([]);
  });

  it("warns on names, dates of birth, NDIS numbers, addresses and health details", () => {
    expect(kinds("We support Jane Doe three days a week")).toContain("name");
    expect(kinds("participant DOB 12/03/1998")).toContain("date-of-birth");
    expect(kinds("born 3-4-2001")).toContain("date-of-birth");
    expect(kinds("NDIS number 430123456")).toContain("ndis-number");
    expect(kinds("visits at 12 Example Street every morning")).toContain(
      "address",
    );
    expect(kinds("one client was diagnosed with autism last year")).toContain(
      "health",
    );
  });

  it("does not treat state names or standard names as people", () => {
    expect(kinds("Western Australia and South Australia")).toEqual([]);
    expect(kinds("aligned to the Practice Standards")).toEqual([]);
  });

  it("returns one warning per kind with a plain-English message", () => {
    const w = detectParticipantData(
      "Mr Smith, DOB 1/1/1990, 430000000, 5 Main Road, autism",
    );
    expect(w.map((x) => x.kind)).toEqual([
      "name",
      "date-of-birth",
      "ndis-number",
      "address",
      "health",
    ]);
    for (const x of w) expect(x.message.length).toBeGreaterThan(20);
  });
});

// REQ-035 (D-2302): a provider's whole policy runs through the gate, so its business name, its
// own headings and a heading followed by the next line's sentence are not read as a person; a
// titled name and a plain two-word name on one line still are.
describe("the gate over a whole policy (REQ-035)", () => {
  it("passes a business name, a policy's headings and a heading over a sentence, and still catches a name", () => {
    for (const ok of [
      "Example Supports welcomes complaints as a way to improve.",
      "Sunrise Supports delivers household tasks in Newcastle.",
      "Policy Statement\nIncident Management and Complaints Feedback",
      "Purpose\n\nThis policy says what we do.\n\nResponsibilities\n\nThe owner decides.",
    ])
      expect(detectParticipantData(ok), ok).toEqual([]);
    expect(
      detectParticipantData("A complaint from Mr J. Smith was handled.").map(
        (w) => w.kind,
      ),
    ).toEqual(["name"]);
    expect(
      detectParticipantData("Spoke with Jane Citizen about the roster.").map(
        (w) => w.kind,
      ),
    ).toEqual(["name"]);
  });
});
