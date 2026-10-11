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
