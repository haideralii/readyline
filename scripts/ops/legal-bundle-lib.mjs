/**
 * Pure helpers for scripts/ops/legal-bundle.mjs (REQ-022 FR-11, AC-6): the
 * lawyer's bundle is one markdown index of everything a lawyer reads, built
 * from the committed files and the public pages' URLs. Nothing here touches
 * the network or git; the runner supplies the file texts and the dates, so
 * the unit test (legal-bundle.test.ts) can run the whole build against the
 * repository with a stubbed clock and a stubbed "last changed" lookup.
 *
 * No customer data of any kind goes in: the inputs are the product owner's
 * markdown, the source files' paths and dates, and the committed fixtures.
 * `fixtureAddresses` is the self-check AC-6 asks for: the index must carry no
 * string from the fixture accounts' addresses.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** REQ-008's five legal and trust pages, in the footer's order (src/lib/legal/nav.ts). */
export const LEGAL_PAGES = [
  { slug: "terms", path: "/terms" },
  { slug: "privacy", path: "/privacy" },
  { slug: "refunds", path: "/refunds" },
  { slug: "ai", path: "/ai" },
  { slug: "about", path: "/about" },
];

/**
 * The model vendor's commercial terms, as read by the Dev on 18 October 2026
 * (D-2288): the page states "Effective June 17, 2025" and, under section B
 * ("Customer Content"), that Anthropic may not train models on Customer
 * Content from the Services. The privacy and AI pages' sentence "as read on
 * <date>" takes its date from this index's filename (src/lib/legal/vendor-terms.ts).
 */
export const VENDOR_TERMS = {
  title: "Anthropic Commercial Terms of Service",
  url: "https://www.anthropic.com/legal/commercial-terms",
  effective: "17 June 2025",
  clause:
    'Section B, "Customer Content": "Anthropic may not train models on Customer Content from Services."',
};

/** The two refund sections the pricing page and the documents page read (src/lib/payments/refund-promise.ts). */
export const REFUND_SECTIONS = ["Our promise", "The document pack"];

/** The code surfaces listed after the pages, each with the files whose last change dates it. */
export const CODE_SURFACES = {
  appendix: [
    "src/lib/generator/fixed-extras.ts",
    "data/readyline-content/document-types.json",
  ],
  pricing: ["src/app/pricing/page.tsx", "src/lib/payments/copy.ts"],
  signIn: ["src/app/sign-in/page.tsx", "src/app/sign-in/sign-in-form.tsx"],
  accountSetup: [
    "src/app/account/setup/page.tsx",
    "src/app/account/account-form.tsx",
  ],
  templates: ["src/server/email/templates.ts"],
  documentSet: ["product/evidence/req-005/sole-trader"],
};

/** The two templates FR-11 names, by the name each gives itself in templates.ts. */
export const TEMPLATE_NAMES = ["worker-invitation", "reminders"];

export const QUESTIONS_PATH = "product/legal/questions-for-the-lawyer.md";
export const DOCUMENT_SET_DIR = "product/evidence/req-005/sole-trader";

/** A fixture account's address: the e2e and unit fixtures use example.test, example.com and readyline.example. */
const FIXTURE_ADDRESS =
  /[A-Za-z0-9._%+-]+@(?:example\.(?:test|com|org|net)|readyline\.example)\b/g;

/** The distinct fixture addresses in a text, in order; empty when there are none (AC-6). */
export function fixtureAddresses(text) {
  return [...new Set(text.match(FIXTURE_ADDRESS) ?? [])];
}

/** "2026-10-18" to "18 October 2026"; anything else is returned as given. */
export function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return iso ?? "";
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${Number(m[1])}`;
}

/** Today's date in Sydney as YYYY-MM-DD (the machine may be anywhere; the index is dated where the business is). */
export function sydneyToday(now = new Date()) {
  return now.toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
}

/**
 * The `---` block at the head of a product/legal page: `key: value` lines
 * (the same shape src/lib/legal/pages.ts reads). Only `updated` and `title`
 * are used here.
 */
export function parseFrontMatter(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!m) return { data: {}, content: raw };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (kv) data[kv[1]] = kv[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return { data, content: m[2] };
}

/** The paragraphs under the named `##` headings of a markdown body, in order (as refund-promise.ts reads them). */
export function sectionParagraphs(markdown, headings) {
  const out = [];
  let collecting = false;
  for (const line of markdown.split(/\r?\n/)) {
    const h = /^##\s+(.*)$/.exec(line);
    if (h) {
      collecting = headings.includes(h[1].trim());
      continue;
    }
    if (/^#\s/.test(line)) {
      collecting = false;
      continue;
    }
    if (collecting && line.trim()) out.push(line.trim());
  }
  return out;
}

/**
 * The questions in product/legal/questions-for-the-lawyer.md: every line that
 * starts "N.N " is one, and the question is the text before the role's
 * " Read:" answer. The heading each sits under is kept for the index.
 */
export function questionLines(markdown) {
  const out = [];
  let heading = null;
  for (const line of markdown.split(/\r?\n/)) {
    const h = /^##\s+(.*)$/.exec(line);
    if (h) {
      heading = h[1].trim();
      continue;
    }
    const q = /^(\d+\.\d+)\s+(.*)$/.exec(line);
    if (!q) continue;
    const text = q[2].split(/\s+Read:/)[0].trim();
    out.push({ number: q[1], question: text, heading });
  }
  return out;
}

/**
 * Everything the index needs, read from the repository at `root`.
 * `lastChanged(paths)` returns YYYY-MM-DD for the newest change among the
 * paths (the runner asks git; the test stubs it).
 */
export function collect(root, { lastChanged }) {
  const read = (rel) => readFileSync(join(root, rel), "utf8");
  const legalPages = LEGAL_PAGES.map(({ slug, path }) => {
    const { data } = parseFrontMatter(read(`product/legal/${slug}.md`));
    return {
      slug,
      path,
      title: data.title ?? slug,
      updated: data.updated ?? "",
      source: `product/legal/${slug}.md`,
    };
  });
  const refunds = legalPages.find((p) => p.slug === "refunds");
  const refundParagraphs = sectionParagraphs(
    parseFrontMatter(read("product/legal/refunds.md")).content,
    REFUND_SECTIONS,
  );
  const questionsRaw = read(QUESTIONS_PATH);
  const questions = {
    path: QUESTIONS_PATH,
    updated: parseFrontMatter(questionsRaw).data.updated ?? "",
    items: questionLines(questionsRaw),
  };
  const setFiles = readdirSync(join(root, DOCUMENT_SET_DIR))
    .filter((f) => f.endsWith(".docx"))
    .sort();
  const sectionsHead = read(`${DOCUMENT_SET_DIR}/sections.md`)
    .split(/\r?\n/)
    .filter((l) => /^(Case|Rendered)/.test(l));
  return {
    legalPages,
    refund: { paragraphs: refundParagraphs, updated: refunds?.updated ?? "" },
    appendix: { updated: lastChanged(CODE_SURFACES.appendix) },
    pricing: { updated: lastChanged(CODE_SURFACES.pricing) },
    signIn: { updated: lastChanged(CODE_SURFACES.signIn) },
    accountSetup: { updated: lastChanged(CODE_SURFACES.accountSetup) },
    templates: { updated: lastChanged(CODE_SURFACES.templates) },
    documentSet: {
      files: setFiles,
      head: sectionsHead,
      updated: lastChanged(CODE_SURFACES.documentSet),
    },
    questions,
  };
}

const entry = (n, title, where, updated, more = []) =>
  [
    `${n}. **${title}.** ${where} Last updated: ${formatDate(updated)}.`,
    ...more.map((l) => `   ${l}`),
  ].join("\n");

/**
 * The index as markdown: the FR-12 questions at the head, then the entries in
 * FR-11's order, each with its URL (or committed path) and its date.
 */
export function renderIndex({ date, base, vendorReadOn, data }) {
  // Without a base (the domain is not registered yet, CLAUDE.md 4.1) the entries carry the
  // site paths; the PO rebuilds with `--base https://<domain>` on the day (D-2288).
  const url = (path) => `${base ?? ""}${path}`;
  const lines = [];
  lines.push(`# Legal bundle index, ${formatDate(date)}`);
  lines.push("");
  lines.push(
    `Built by \`scripts/ops/legal-bundle.mjs\` on ${formatDate(date)} from the committed files and the public pages' addresses (REQ-022 FR-11). No PDF and no browser: a reader opens each URL and each committed file. No customer data of any kind: the pages are public and the document set is the committed fixture case. The model vendor's terms are quoted as read on the date shown. The privacy and AI pages' "as read on" date is this index's date.${base ? "" : " The pages are given as paths on the site; rebuild with `--base https://<domain>` for full addresses once the domain is live."}`,
  );
  lines.push("");
  lines.push("## Questions for the lawyer (FR-12)");
  lines.push("");
  lines.push(
    `The product owner's questions are in \`${data.questions.path}\` (last updated ${formatDate(data.questions.updated)}), each with the lawyer role's read under it. The questions, in that file's order:`,
  );
  lines.push("");
  let heading = null;
  for (const q of data.questions.items) {
    if (q.heading !== heading) {
      heading = q.heading;
      lines.push(`- ${heading}`);
    }
    lines.push(`  - ${q.number} ${q.question}`);
  }
  lines.push("");
  lines.push("## The bundle, in order");
  lines.push("");
  let n = 0;
  for (const p of data.legalPages) {
    n += 1;
    lines.push(
      entry(n, p.title, `${url(p.path)} (source \`${p.source}\`).`, p.updated),
    );
  }
  n += 1;
  lines.push(
    entry(
      n,
      "The AI and digital tools appendix",
      `The provider's own statement on AI and digital tools, an unnumbered appendix to the privacy policy in every pack (REQ-016 S-6): fixed text in \`${CODE_SURFACES.appendix[0]}\` (section \`ai-and-digital-tools\` in \`${CODE_SURFACES.appendix[1]}\`), rendered in \`${DOCUMENT_SET_DIR}/privacy-and-information-management-policy.docx\`.`,
      data.appendix.updated,
    ),
  );
  n += 1;
  lines.push(
    entry(
      n,
      VENDOR_TERMS.title,
      `${VENDOR_TERMS.url}, the page states "Effective ${VENDOR_TERMS.effective}"; read on ${formatDate(vendorReadOn)}. This is the source for the privacy page's and the AI page's sentence that Anthropic does not use our requests to train its models. As read: ${VENDOR_TERMS.clause}`,
      vendorReadOn,
    ),
  );
  n += 1;
  lines.push(
    entry(
      n,
      "The refund promise as it appears on /pricing and /documents",
      `${url("/pricing")} (before purchase) and ${url("/documents")} (signed in, after purchase) read the "${REFUND_SECTIONS.join('" and "')}" sections of \`product/legal/refunds.md\` at render time, so the three say the same thing. The paragraphs:`,
      data.refund.updated,
      data.refund.paragraphs.map((p) => `> ${p}`),
    ),
  );
  n += 1;
  lines.push(
    entry(
      n,
      "The pricing page",
      `${url("/pricing")} (source \`${CODE_SURFACES.pricing[0]}\`, words in \`${CODE_SURFACES.pricing[1]}\`).`,
      data.pricing.updated,
    ),
  );
  n += 1;
  lines.push(
    entry(
      n,
      "The sign-in screen",
      `${url("/sign-in")} (source \`${CODE_SURFACES.signIn[1]}\`).`,
      data.signIn.updated,
    ),
  );
  n += 1;
  lines.push(
    entry(
      n,
      "The account-setup screen",
      `${url("/account/setup")} (signed in; source \`${CODE_SURFACES.accountSetup[1]}\`).`,
      data.accountSetup.updated,
    ),
  );
  n += 1;
  lines.push(
    entry(
      n,
      "The worker invitation and reminder email templates",
      `\`${CODE_SURFACES.templates[0]}\`, the templates named \`${TEMPLATE_NAMES.join("` and `")}\`; every sentence is quoted and checked in \`src/server/email/templates.test.ts\`. Listed, not rendered: the index is built without a server or a model (D-2288).`,
      data.templates.updated,
    ),
  );
  n += 1;
  lines.push(
    entry(
      n,
      "One generated sole-trader document set",
      `\`${DOCUMENT_SET_DIR}/\`, the committed REQ-005 reference case (${data.documentSet.files.length} \`.docx\` files, with \`sections.md\` saying which sections are model text and which are fixed):`,
      data.documentSet.updated,
      [
        ...data.documentSet.head.map((l) => `${l}`),
        ...data.documentSet.files.map((f) => `- \`${f}\``),
      ],
    ),
  );
  lines.push("");
  lines.push(
    "General information and templates for the provider's own review; not legal advice. This index is for the practising lawyer the product owner engages.",
  );
  lines.push("");
  return lines.join("\n");
}

/** The index's filename for a date; src/lib/legal/vendor-terms.ts reads the date back from it. */
export function indexFileName(date) {
  return `legal-bundle-${date}.md`;
}
