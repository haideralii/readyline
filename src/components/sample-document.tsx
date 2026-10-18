import type { DocumentModel } from "@/lib/generator/document-model";
import type { Block } from "@/lib/generator/section-schema";
import { SAMPLE_DOCUMENT, SAMPLE_DOWNLOAD_PATH } from "@/lib/sample-document";
import { HOME_COPY as C } from "@/lib/home-copy";
import { findGlossaryTerms } from "@/lib/copy-lint/glossary";
import { DataTable } from "./data-table";
import { GlossaryTerms } from "./glossary-terms";

/**
 * The sample document preview (batch 24 item 2): every section of the
 * committed sample, with the sections the model drafted from the fictional
 * provider's answers visibly marked, and the fixed legal text shown as what
 * it is. A real document from the recorded sole-trader set, not a mock-up.
 */
export function Blocks({
  blocks,
  omitCallout,
}: {
  blocks: readonly Block[];
  /** REQ-028 FR-15 (audit 56): the callout the document shows once above itself is not repeated in a section. */
  omitCallout?: string;
}) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "paragraph":
            return (
              <p key={i} className="mt-2 leading-7">
                {b.text}
              </p>
            );
          case "callout":
            if (b.text === omitCallout) return null;
            return (
              <p
                key={i}
                className="border-ochre bg-ochre-wash mt-2 rounded-md border p-4 leading-7"
              >
                {b.text}
              </p>
            );
          case "bullets":
            return (
              <ul key={i} className="mt-2 list-disc space-y-1 pl-5 leading-7">
                {b.items.map((t, j) => (
                  <li key={j}>{t}</li>
                ))}
              </ul>
            );
          case "steps":
            return (
              <ol
                key={i}
                className="mt-2 list-decimal space-y-1 pl-5 leading-7"
              >
                {b.items.map((t, j) => (
                  <li key={j}>{t}</li>
                ))}
              </ol>
            );
          case "table":
            // REQ-013 batch 36: stacked rows on phones, a table that never
            // splits a word on wider screens; its scrolling region is
            // focusable (backlog 1, axe scrollable-region-focusable).
            return <DataTable key={i} columns={b.columns} rows={b.rows} />;
        }
      })}
    </>
  );
}

/** Document control, Purpose and Scope are open; the rest is one tap away. */
const SHOWN_FIRST = 3;

const MODE_LABEL = {
  tailored: "Drafted from the answers",
  fixed: "Fixed text, the same for every provider",
} as const;
const DOWNLOAD_LABEL = "Download this sample as a Word file";

function sampleLine(doc: DocumentModel, tailored: number): string {
  return `Sample: ${doc.facts.tradingName} (a fictional sole trader, household tasks, New South Wales, verification audit). Generated ${doc.generatedAt}; ${tailored} of ${doc.sections.length} sections drafted from the answers, the rest fixed text.`;
}

function blockText(b: Block): string[] {
  switch (b.type) {
    case "paragraph":
    case "callout":
      return [b.text];
    case "bullets":
    case "steps":
      return [...b.items];
    case "table":
      return [...b.columns, ...b.rows.map((r) => r.join(" "))];
  }
}

/**
 * REQ-027 FR-3, D-2711, D-2267: the glossary words on the sample page, found at
 * render in the page's own words and the sample document's text (its fixed
 * sections name the Practice Standards and key personnel), so the page carries
 * the disclosure rather than D-2715's one-term bracket.
 */
function samplePresent(
  doc: DocumentModel,
  tailored: number,
  moreText: string,
): string[] {
  return findGlossaryTerms(
    [
      C.sampleHeading,
      C.samplePageLead,
      sampleLine(doc, tailored),
      doc.title,
      DOWNLOAD_LABEL,
      MODE_LABEL.tailored,
      MODE_LABEL.fixed,
      ...doc.sections.flatMap((s) => [
        s.heading,
        ...s.blocks.flatMap(blockText),
      ]),
      doc.footer,
      moreText,
    ].join("\n"),
  );
}

type HeadingTag = "h2" | "h3" | "h4" | "h5";

function Section({
  section: s,
  heading: H,
  omitCallout,
}: {
  section: DocumentModel["sections"][number];
  /** One level under the document's title (REQ-025 FR-12: the sample page's order is h1, h2, h3). */
  heading: HeadingTag;
  omitCallout?: string;
}) {
  return (
    <li
      className={
        s.mode === "tailored"
          ? "border-ochre border-l-4 pl-4"
          : "border-rule border-l-4 pl-4"
      }
      data-testid={`sample-section-${s.id}`}
      data-mode={s.mode}
    >
      <H className="text-lg">
        {s.number ? `${s.number} ` : ""}
        {s.heading}
      </H>
      <p className="text-slate mt-1 text-sm font-medium tracking-wide uppercase">
        {s.mode === "tailored" ? MODE_LABEL.tailored : MODE_LABEL.fixed}
      </p>
      <Blocks blocks={s.blocks} omitCallout={omitCallout} />
    </li>
  );
}

export function SampleDocument({
  level = 3,
  moreText = "",
}: {
  /** The title's heading level: 2 on the sample's own page, 3 under a page section (REQ-025 FR-12). */
  level?: 2 | 3;
  /** REQ-031 FR-3: the page's other words (the Start here sheet), so the one disclosure covers them. */
  moreText?: string;
} = {}) {
  const doc = SAMPLE_DOCUMENT;
  const tailored = doc.sections.filter((s) => s.mode === "tailored").length;
  // REQ-028 FR-15 (audit 56): the document's callout, once above it in the note style; its words are the data's.
  const callout = doc.sections
    .flatMap((s) => s.blocks)
    .find(
      (b): b is Extract<Block, { type: "callout" }> => b.type === "callout",
    );
  const Title: HeadingTag = level === 2 ? "h2" : "h3";
  const sectionHeading: HeadingTag = level === 2 ? "h3" : "h4";
  return (
    <div
      className="bg-paper border-rule rounded-md border p-4 sm:p-6"
      data-testid="sample-document"
    >
      <p className="text-slate text-sm">{sampleLine(doc, tailored)}</p>
      {/* REQ-027 FR-3, D-2701: the words on this page, the document's own included, above the document. */}
      <GlossaryTerms
        ids={samplePresent(doc, tailored, moreText)}
        where="page"
        className="mt-2"
      />
      <Title className="mt-2">{doc.title}</Title>
      {callout ? (
        <p
          className="border-ochre bg-ochre-wash mt-3 rounded-md border p-4 leading-7"
          data-testid="sample-callout"
        >
          {callout.text}
        </p>
      ) : null}
      <p className="mt-3">
        <a
          href={SAMPLE_DOWNLOAD_PATH}
          className="btn-secondary text-sm"
          data-testid="sample-download"
        >
          {DOWNLOAD_LABEL}
        </a>
      </p>
      <ol className="mt-6 space-y-5">
        {doc.sections.slice(0, SHOWN_FIRST).map((s) => (
          <Section
            key={s.id}
            section={s}
            heading={sectionHeading}
            omitCallout={callout?.text}
          />
        ))}
      </ol>
      {/* The rest folds away so the page stays short on a phone; a native
          disclosure needs no script and the sections stay in the document. */}
      <details className="mt-5">
        <summary
          className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium underline underline-offset-2"
          data-testid="sample-more"
        >
          Show the other {doc.sections.length - SHOWN_FIRST} sections
        </summary>
        <ol className="mt-5 space-y-5" start={SHOWN_FIRST + 1}>
          {doc.sections.slice(SHOWN_FIRST).map((s) => (
            <Section
              key={s.id}
              section={s}
              heading={sectionHeading}
              omitCallout={callout?.text}
            />
          ))}
        </ol>
      </details>
      <p className="text-slate mt-6 text-sm">{doc.footer}</p>
    </div>
  );
}
