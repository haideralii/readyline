import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  START_HERE_FILE,
  countsLine,
  documentCountsLine,
  type FillLine,
  type SectionLine,
} from "@/lib/generator/start-here";
import { getViewer } from "@/server/accounts/queries";
import { getVersionSet } from "@/server/generation/queries";
import { startHereForSet } from "@/server/generation/start-here-set";
import { isSetLocked } from "@/server/payments/queries";
import { createSupabaseServerClient } from "@/server/supabase/server";

export const metadata: Metadata = { title: "Start here" };

/**
 * The Start here sheet as a page (REQ-026 FR-1, FR-4): the same list as
 * the Word file, printable, with a tick on every "Fill in" line whose
 * blank the Finish form has filled and on every adopted document; the
 * Word-only lines keep their printed box.
 */
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

export default async function StartHerePage({
  params,
}: PageProps<"/documents/[setId]/start-here">) {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=%2Fdocuments");
  if (!viewer.account) redirect("/account/setup");
  const { setId } = await params;
  const supabase = await createSupabaseServerClient();
  const set = await getVersionSet(supabase, setId);
  if (!set || set.account_id !== viewer.account.id) notFound();
  if (await isSetLocked(supabase, set.id)) redirect(`/documents/${set.id}`);
  const built = await startHereForSet(supabase, set);
  if (!built) notFound();
  const s = built.sheet;
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-sm print:hidden">
        <Link
          href={`/documents/${set.id}`}
          className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
        >
          ‹ Document set
        </Link>
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Start here: {s.tradingName}
      </h1>
      <p className="mt-3 text-lg leading-7" data-testid="start-here-counts">
        {countsLine(s.counts)}
      </p>
      <p className="mt-2 print:hidden">
        <a
          href={`/documents/${set.id}/download?file=${START_HERE_FILE}`}
          className="btn-secondary"
          data-testid="start-here-download"
        >
          Download this list (Word)
        </a>
      </p>

      <section aria-labelledby="one-minute" className="mt-8">
        <h2 id="one-minute" className="text-xl font-semibold">
          1. Your pack in one minute
        </h2>
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
        <h2 id="first" className="text-xl font-semibold">
          2. Do these first
        </h2>
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
        <h2 id="each" className="text-xl font-semibold">
          3. For each document
        </h2>
        <ol className="mt-2 space-y-6" data-testid="sheet-documents">
          {s.documents.map((d) => (
            <li
              key={d.typeId}
              className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
              data-testid={`sheet-document-${d.typeId}`}
              data-adopted={d.adopted ? "true" : "false"}
            >
              <h3 className="text-base font-semibold">
                {d.n}. {d.title}{" "}
                <span className="font-normal text-zinc-600 dark:text-zinc-400">
                  (about {d.minutes} minutes; {documentCountsLine(d)})
                </span>
              </h3>
              <ul className="mt-2">
                <li className="py-1 leading-7">
                  <span className="font-medium">Open:</span>{" "}
                  <Link
                    href={`/documents/${set.id}/${d.typeId}`}
                    className="underline underline-offset-4"
                  >
                    {d.file}
                  </Link>
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
        <h2 id="registers" className="text-xl font-semibold">
          4. Registers
        </h2>
        <ul
          className="mt-2 list-disc pl-5 leading-7"
          data-testid="sheet-registers"
        >
          {s.registers.map((r) => (
            <li key={r.title}>
              <span className="font-medium">{r.title}</span>: {r.purpose}{" "}
              <span className="text-zinc-600 dark:text-zinc-400">
                {r.where}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="done" className="mt-8">
        <h2 id="done" className="text-xl font-semibold">
          5. When you are done
        </h2>
        <ol
          className="mt-2 list-decimal pl-5 leading-7"
          data-testid="sheet-next"
        >
          {s.next.map((n) => (
            <li key={n.href}>
              <Link href={n.href} className="underline underline-offset-4">
                {n.text}
              </Link>
            </li>
          ))}
        </ol>
      </section>
      <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">
        Generated {s.generatedAt}; readiness summary version {s.summaryVersion}.
      </p>
    </div>
  );
}
