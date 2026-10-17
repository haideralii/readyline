import { describe, expect, it } from "vitest";
import {
  hasDmarc,
  hasSpf,
  judgeSenderDomain,
  senderDomain,
} from "./sender-domain";

describe("the sending domain's records (REQ-022 FR-6, D-2824)", () => {
  it("reads the domain out of EMAIL_FROM in both forms and refuses junk", () => {
    expect(senderDomain("Readyline <no-reply@Readyline.example>")).toBe(
      "readyline.example",
    );
    expect(senderDomain("no-reply@readyline.example")).toBe(
      "readyline.example",
    );
    expect(senderDomain("")).toBeNull();
    expect(senderDomain(undefined)).toBeNull();
    expect(senderDomain("not an address")).toBeNull();
    expect(senderDomain("Readyline <no-reply@localhost>")).toBeNull();
  });

  it("recognises SPF and DMARC records among chunked TXT answers", () => {
    expect(hasSpf([["v=spf1 include:", "mail.example ~all"]])).toBe(true);
    expect(hasSpf([["some=other"], ["v=spf2 nope"]])).toBe(false);
    expect(hasDmarc([["v=DMARC1; p=none; rua=mailto:a@b.example"]])).toBe(true);
    expect(hasDmarc([["v=spf1 -all"]])).toBe(false);
  });

  it("judges the row: unverified without a sender or an answer, mismatched naming the missing record, set with both", () => {
    expect(judgeSenderDomain(undefined, null).state).toBe("unverified");
    expect(
      judgeSenderDomain("Readyline <a@b.example>", { spf: null, dmarc: true })
        .state,
    ).toBe("unverified");
    const one = judgeSenderDomain("Readyline <a@b.example>", {
      spf: true,
      dmarc: false,
    });
    expect(one.state).toBe("mismatched");
    expect(one.sentence).toContain("no DMARC record");
    expect(one.sentence).not.toContain("SPF or");
    expect(
      judgeSenderDomain("a@b.example", { spf: true, dmarc: true }).state,
    ).toBe("set");
  });
});
