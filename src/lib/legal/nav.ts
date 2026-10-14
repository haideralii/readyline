/**
 * The legal and trust pages (REQ-008): slugs, routes and footer labels. Kept
 * free of Node imports so the footer and any client code can use it.
 */
export const LEGAL_SLUGS = [
  "terms",
  "privacy",
  "refunds",
  "ai",
  "about",
] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export const LEGAL_NAV: ReadonlyArray<{
  slug: LegalSlug | "guides";
  href: `/${LegalSlug}` | "/guides";
  label: string;
}> = [
  { slug: "terms", href: "/terms", label: "Terms" },
  { slug: "privacy", href: "/privacy", label: "Privacy" },
  { slug: "refunds", href: "/refunds", label: "Refunds" },
  { slug: "ai", href: "/ai", label: "How we use AI" },
  { slug: "about", href: "/about", label: "About" },
  // REQ-011 batch 31 item 3: the guides and the registration-group pages, from every footer.
  { slug: "guides", href: "/guides", label: "Guides" },
];

export function isLegalSlug(value: string): value is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(value);
}
