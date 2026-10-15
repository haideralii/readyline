import type { DocumentModel } from "@/lib/generator/document-model";
import type { Block } from "@/lib/generator/section-schema";
import { SAMPLE_DOCUMENT, SAMPLE_DOWNLOAD_PATH } from "@/lib/sample-document";
import { DataTable } from "./data-table";

/**
 * The sample document preview (batch 24 item 2): every section of the
 * committed sample, with the sections the model drafted from the fictional
 * provider's answers visibly marked, and the fixed legal text shown as what
 * it is. A real document from the recorded sole-trader set, not a mock-up.
 */
export function Blocks({ blocks }: { blocks: readonly Block[] }) {
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
            return (
              <p
                key={i}
                className="mt-2 rounded-md border border-zinc-300 bg-zinc-50 p-3 leading-7 dark:border-zinc-700 dark:bg-zinc-900"
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

type HeadingTag = "h2" | "h3" | "h4" | "h5";

function Section({
  section: s,
  heading: H,
}: {
  section: DocumentModel["sections"][number];
  /** One level under the document's title (REQ-025 FR-12: the sample page's order is h1, h2, h3). */
  heading: HeadingTag;
}) {
  return (
    <li
      className={
        s.mode === "tailored"
          ? "border-ochre border-l-4 pl-4"
          : "border-l-4 border-zinc-200 pl-4 dark:border-zinc-800"
      }
      data-testid={`sample-section-${s.id}`}
      data-mode={s.mode}
    >
      <H className="text-lg">
        {s.number ? `${s.number} ` : ""}
        {s.heading}
      </H>
      <p className="text-slate mt-1 text-xs font-medium tracking-wide uppercase">
        {s.mode === "tailored"
          ? "Drafted from the answers"
          : "Fixed text, the same for every provider"}
      </p>
      <Blocks blocks={s.blocks} />
    </li>
  );
}

export function SampleDocument({
  level = 3,
}: {
  /** The title's heading level: 2 on the sample's own page, 3 under a page section (REQ-025 FR-12). */
  level?: 2 | 3;
} = {}) {
  const doc = SAMPLE_DOCUMENT;
  const tailored = doc.sections.filter((s) => s.mode === "tailored").length;
  const Title: HeadingTag = level === 2 ? "h2" : "h3";
  const sectionHeading: HeadingTag = level === 2 ? "h3" : "h4";
  return (
    <div
      className="bg-paper rounded-md border border-zinc-300 p-4 sm:p-6 dark:border-zinc-700"
      data-testid="sample-document"
    >
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Sample: {doc.facts.tradingName} (a fictional sole trader, household
        tasks, New South Wales, verification audit). Generated {doc.generatedAt}
        ; {tailored} of {doc.sections.length} sections drafted from the answers,
        the rest fixed text.
      </p>
      <Title className="mt-2 text-2xl">{doc.title}</Title>
      <p className="mt-3">
        <a
          href={SAMPLE_DOWNLOAD_PATH}
          className="btn-secondary text-sm"
          data-testid="sample-download"
        >
          Download this sample as a Word file
        </a>
      </p>
      <ol className="mt-6 space-y-5">
        {doc.sections.slice(0, SHOWN_FIRST).map((s) => (
          <Section key={s.id} section={s} heading={sectionHeading} />
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
            <Section key={s.id} section={s} heading={sectionHeading} />
          ))}
        </ol>
      </details>
      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        {doc.footer}
      </p>
    </div>
  );
}
