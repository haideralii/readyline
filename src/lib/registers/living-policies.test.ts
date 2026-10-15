// @vitest-environment node
/**
 * Living policies (backlog 8, D-551): the ledger validates against the
 * catalogue, and the matcher flags a document only when it predates the
 * change, is in scope, does not carry the new sentence and has not been
 * checked; the old sentence makes the finding certain.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { documentTypeById, sectionsFor } from "@/lib/generator/catalogue";
import {
  changesForDocument,
  describeChange,
  loadWatchChanges,
  type WatchChange,
} from "./living-policies";

const changes = loadWatchChanges();

describe("the watch-changes ledger", () => {
  it("has unique ids, dated entries, and scopes that exist in the catalogue", () => {
    expect(changes.length).toBeGreaterThanOrEqual(7);
    expect(new Set(changes.map((c) => c.id)).size).toBe(changes.length);
    for (const c of changes) {
      for (const typeId of c.documentTypeIds) {
        const type = documentTypeById(typeId);
        expect(type, `${c.id}: ${typeId}`).toBeDefined();
        if (c.sectionId)
          expect(
            sectionsFor(type!).some((s) => s.id === c.sectionId),
            `${c.id}: ${typeId}/${c.sectionId}`,
          ).toBe(true);
      }
      expect(c.newSentence).not.toMatch(/guarantee|approved by|audit-proof/i);
    }
  });
});

const change: WatchChange = {
  id: "wc-2026-10-14-99",
  appliedOn: "2026-10-14",
  where: "fixed-text",
  documentTypeIds: ["records-management-policy"],
  sectionId: "retention-schedule",
  oldSentence: "Incident and complaint records | [Provider to confirm]",
  newSentence:
    "Reportable incident records | 7 years from the date we notified the Commission",
  why: "Incident Rules s 25.",
  source: "https://example.test/rules",
  watchReport: "test",
};

const doc = (over: Partial<Parameters<typeof changesForDocument>[0]> = {}) => ({
  typeId: "records-management-policy",
  createdAt: "2026-10-10T03:00:00Z",
  sections: [
    { id: "purpose", text: "Why we keep records." },
    {
      id: "retention-schedule",
      text: "Record | Kept for\nIncident and complaint records | [Provider to confirm]",
    },
  ],
  ...over,
});

describe("changesForDocument", () => {
  it("flags a document drafted before the change that still carries the old sentence, as certain", () => {
    const r = changesForDocument(doc(), [change]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      changeId: change.id,
      sectionId: "retention-schedule",
      certainty: "certain",
      oldSentence: change.oldSentence,
    });
    expect(describeChange(r[0])).toMatch(
      /^Since 2026-10-14, the fixed text replaces one sentence\./,
    );
  });

  it("does not flag a document drafted on or after the change, one that already carries the new sentence, one out of scope, or one already checked", () => {
    expect(
      changesForDocument(doc({ createdAt: "2026-10-14T00:00:00Z" }), [change]),
    ).toEqual([]);
    expect(
      changesForDocument(
        doc({
          sections: [
            { id: "retention-schedule", text: `x\n${change.newSentence}` },
          ],
        }),
        [change],
      ),
    ).toEqual([]);
    expect(
      changesForDocument(doc({ typeId: "governance-policy" }), [change]),
    ).toEqual([]);
    expect(changesForDocument(doc(), [change], new Set([change.id]))).toEqual(
      [],
    );
  });

  it("an added sentence (no old sentence) is a likely finding; a scoped section missing from the document is not one; null scope searches the whole document", () => {
    const added: WatchChange = {
      ...change,
      id: "wc-2026-10-14-98",
      oldSentence: null,
      where: "brief",
    };
    const r = changesForDocument(doc(), [added]);
    expect(r).toHaveLength(1);
    expect(r[0].certainty).toBe("likely");
    expect(describeChange(r[0])).toMatch(/includes a new sentence/);
    expect(
      changesForDocument(doc({ sections: [{ id: "purpose", text: "x" }] }), [
        added,
      ]),
    ).toEqual([]);
    const anywhere: WatchChange = {
      ...added,
      id: "wc-2026-10-14-97",
      sectionId: null,
    };
    expect(
      changesForDocument(doc({ sections: [{ id: "purpose", text: "x" }] }), [
        anywhere,
      ]),
    ).toHaveLength(1);
    expect(
      changesForDocument(
        doc({ sections: [{ id: "purpose", text: added.newSentence }] }),
        [anywhere],
      ),
    ).toEqual([]);
  });
});

// D-2004 (batch 45): the watch's apply step refuses without a ledger entry.
// Every watch note that says what it applied names ledger ids, and every id
// it names exists; every ledger entry points at a watch note that exists.
describe("the watch notes and the ledger agree (D-2004)", () => {
  const notesDir = join(process.cwd(), "product", "research", "ndis-watch");
  const notes = readdirSync(notesDir).filter((f) => f.endsWith(".md"));

  it("every ledger id a watch note cites is in the ledger", () => {
    const ids = new Set(changes.map((c) => c.id));
    for (const f of notes) {
      const text = readFileSync(join(notesDir, f), "utf8");
      for (const m of text.matchAll(/wc-\d{4}-\d{2}-\d{2}-\d{2}/g))
        expect(ids.has(m[0]), `${f} cites ${m[0]}`).toBe(true);
      // A range "wc-2026-10-15-01 to wc-2026-10-15-05" names every id between.
      for (const m of text.matchAll(
        /(wc-\d{4}-\d{2}-\d{2}-)(\d{2}) to wc-\d{4}-\d{2}-\d{2}-(\d{2})/g,
      )) {
        for (let n = Number(m[2]); n <= Number(m[3]); n += 1)
          expect(
            ids.has(`${m[1]}${String(n).padStart(2, "0")}`),
            `${f} range names ${m[1]}${String(n).padStart(2, "0")}`,
          ).toBe(true);
      }
    }
  });

  it("every ledger entry from 15 October 2026 points at a watch note that exists, and any file an older entry names exists too", () => {
    for (const c of changes) {
      const file = c.watchReport.match(/product\/[\w./-]+\.md/)?.[0];
      if (c.appliedOn >= "2026-10-15")
        expect(file, `${c.id}: watchReport names a file`).toBeTruthy();
      if (file)
        expect(existsSync(join(process.cwd(), file)), `${c.id}: ${file}`).toBe(
          true,
        );
    }
  });

  it("a watch note written on or after 15 October 2026 that applied a rule has an Applied section naming the ledger", () => {
    for (const f of notes) {
      const day = f.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? "";
      if (day < "2026-10-15") continue;
      const text = readFileSync(join(notesDir, f), "utf8");
      if (/## Applied/.test(text)) {
        expect(text, `${f}: the Applied section names ledger ids`).toMatch(
          /wc-\d{4}-\d{2}-\d{2}-\d{2}/,
        );
      }
    }
  });
});
