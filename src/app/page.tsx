import Link from "next/link";
import { BRAND } from "@/lib/brand";

const PLANNED = [
  "A short guided questionnaire about the supports you deliver, your workers and where you operate.",
  "Which Practice Standards modules apply to you, and whether you face a verification or certification audit.",
  "A tailored set of policies and procedures and a self-assessment, as editable Word documents for your review.",
  "A readiness checklist showing which documents, registers, clearances and insurances are still missing.",
  "Optional ongoing registers for incidents, complaints, worker screening expiry and policy reviews.",
];

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <section className="max-w-2xl">
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          For sole traders and small providers
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Get ready for mandatory NDIS provider registration without a
          consultant
        </h1>
        <p className="mt-4 text-lg leading-8 text-zinc-700 dark:text-zinc-300">
          {BRAND} is being built to help you prepare documents aligned to the
          NDIS Practice Standards, see what is still missing before your audit,
          and keep your registers up to date afterwards. Everything is prepared
          for your review; you decide what to adopt.
        </p>
        <p className="mt-6">
          <Link
            href="/start"
            className="inline-flex min-h-12 items-center justify-center rounded-md bg-zinc-900 px-5 text-base font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Find out what registration needs from you
          </Link>
        </p>
      </section>

      <section className="mt-12 max-w-2xl" aria-labelledby="planned-heading">
        <h2 id="planned-heading" className="text-xl font-semibold">
          What it will do
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-zinc-700 dark:text-zinc-300">
          {PLANNED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
