import Link from "next/link";
import {
  countsLine,
  documentCountsLine,
  type FillLine,
  type SectionLine,
  type StartHereSheet,
} from "@/lib/generator/start-here";

/**
 * The Start here sheet as a block of a page (REQ-026 FR-1, FR-4; REQ-031
 * FR-3, D-2888): the same list as the Word file, printable, with a tick on
 * every "Fill in" line whose blank the Finish form has filled and on every
 * adopted document; the Word-only lines keep their printed box. With a set
 * id it is the owner's sheet, its lines linking into the set; with none it
 * is the sample's, read-only, every line to do and no link into an account.
 * The heading level follows the page: 1 on the sheet's own page, 2 under
 * the sample page's heading.
 */
type Level = 1 | 2;
const TAGS = {
  1: ["h1", "h2", "h3"],
  2: ["h2", "h3", "h4"],
} as const satisfies Record<Level, readonly [string, string, string]>;

function Line({
  line,
  kind,
}: {
  line: FillLine | SectionLine;
  kind: "fill" | "word" | "review" | "yours";
}) {
  const done = "done" in line && kind === "fill" ? line.done : false;
  const label =
    kind === "fill"
      ? "Fill in"
      : kind === "word"
        ? "Fill in Word"
        : kind === "review"
          ? "Review"
          : "Make it yours";
  return (
    <li
      className="flex items-start gap-2 py-1 leading-7"
      data-testid={`sheet-${kind}`}
      data-done={done ? "true" : "false"}
    >
      <span aria-hidden="true" className="font-mono">
        {done ? "☑" : "☐"}
      </span>
      <span>
        <span className="sr-only">{done ? "Done: " : "To do: "}</span>
        <span className="font-medium">{label}:</span> {line.text}
        {kind === "word" ? " (fill this in Word)" : ""}
        {kind === "yours" ? " (generic text: add your details)" : ""}
      </span>
    </li>
  );
}

export function StartHereSheetView({
  sheet: s,
  setId,
  level,
}: {
  sheet: StartHereSheet;
  /** The owner's set, or null for the sample (no link into an account, no footer). */
  setId: string | null;
  level: Level;
}) {
  const [Title, Section, Doc] = TAGS[level];
  return (
    <>
      <Title className="mt-2">Start here: {s.tradingName}</Title>
      <p className="mt-3 text-lg leading-7" data-testid="start-here-counts">
        {countsLine(s.counts)}
      </p>

      <section aria-labelledby="one-minute" className="mt-8">
        <Section id="one-minute" className="">
          1. Your pack in one minute
        </Section>
        <ul
          className="mt-2 list-disc pl-5 leading-7"
          data-testid="sheet-one-minute"
        >
          {s.oneMinute.map((line) => (
            <li key={line}>{line}</li>
          ))}
          {s.words.map((w) => (
            <li key={w.term} data-testid="sheet-word">
              <span className="font-medium">{w.term}</span>: {w.meaning}.
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="first" className="mt-8">
        <Section id="first" className="">
          2. Do these first
        </Section>
        <ol
          className="mt-2 list-decimal pl-5 leading-7"
          data-testid="sheet-first"
        >
          {s.firstSteps.map((f) => (
            <li key={f.title}>
              <span className="font-medium">{f.title}</span>: {f.why}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="each" className="mt-8">
        <Section id="each" className="">
          3. For each document
        </Section>
        <ol className="mt-2 space-y-6" data-testid="sheet-documents">
          {s.documents.map((d) => (
            <li
              key={d.typeId}
              className="border-rule rounded-md border p-4"
              data-testid={`sheet-document-${d.typeId}`}
              data-adopted={d.adopted ? "true" : "false"}
            >
              <Doc className="">
                {d.n}. {d.title}{" "}
                <span className="text-slate font-normal">
                  (about {d.minutes} minutes; {documentCountsLine(d)})
                </span>
              </Doc>
              <ul className="mt-2">
                <li className="py-1 leading-7">
                  <span className="font-medium">Open:</span>{" "}
                  {setId ? (
                    <Link
                      href={`/documents/${setId}/${d.typeId}`}
                      className="underline underline-offset-4"
                    >
                      {d.file}
                    </Link>
                  ) : (
                    <span>{d.file}</span>
                  )}
                </li>
                {d.fillIn.map((l) => (
                  <Line
                    key={`f-${l.section}-${l.blank}`}
                    line={l}
                    kind="fill"
                  />
                ))}
                {d.fillInWord.map((l) => (
                  <Line
                    key={`w-${l.section}-${l.blank}`}
                    line={l}
                    kind="word"
                  />
                ))}
                {d.review.map((l) => (
                  <Line key={`r-${l.section}`} line={l} kind="review" />
                ))}
                {d.makeYours.map((l) => (
                  <Line key={`y-${l.section}`} line={l} kind="yours" />
                ))}
                {d.readOnce ? (
                  <li className="py-1 leading-7">{d.readOnce}</li>
                ) : null}
                <li
                  className="flex items-start gap-2 py-1 leading-7"
                  data-testid="sheet-adopt"
                  data-done={d.adopted ? "true" : "false"}
                >
                  <span aria-hidden="true" className="font-mono">
                    {d.adopted ? "☑" : "☐"}
                  </span>
                  <span>
                    <span className="sr-only">
                      {d.adopted ? "Done: " : "To do: "}
                    </span>
                    <span className="font-medium">Adopt:</span> sign and date
                    the document control table, then mark it adopted on your
                    documents page.
                  </span>
                </li>
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="registers" className="mt-8">
        <Section id="registers" className="">
          4. Registers
        </Section>
        <ul
          className="mt-2 list-disc pl-5 leading-7"
          data-testid="sheet-registers"
        >
          {s.registers.map((r) => (
            <li key={r.title}>
              <span className="font-medium">{r.title}</span>: {r.purpose}{" "}
              <span className="text-slate">{r.where}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="done" className="mt-8">
        <Section id="done" className="">
          5. When you are done
        </Section>
        <ol
          className="mt-2 list-decimal pl-5 leading-7"
          data-testid="sheet-next"
        >
          {s.next.map((n) => (
            <li key={n.href}>
              {setId ? (
                <Link href={n.href} className="underline underline-offset-4">
                  {n.text}
                </Link>
              ) : (
                <span>{n.text}</span>
              )}
            </li>
          ))}
        </ol>
      </section>
      {setId ? (
        <p className="text-slate mt-8 text-sm">
          Generated {s.generatedAt}; readiness summary version{" "}
          {s.summaryVersion}.
        </p>
      ) : null}
    </>
  );
}
