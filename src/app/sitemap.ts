import type { MetadataRoute } from "next";
import { listGuideSlugs, loadGuide } from "@/lib/guides/pages";
import { LEGAL_NAV } from "@/lib/legal/nav";
import { siteUrl } from "@/lib/site";

/** The public pages and the guides (REQ-011); signed-in pages are left out and disallowed in robots. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const fixed = [
    "/",
    "/start",
    "/pricing",
    "/guides",
    ...LEGAL_NAV.map((l) => l.href),
  ];
  const guides = listGuideSlugs().map((slug) => {
    const g = loadGuide(slug);
    return {
      url: `${base}/guides/${slug}`,
      lastModified: g.updated,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    };
  });
  return [
    ...fixed.map((p) => ({
      url: `${base}${p}`,
      changeFrequency: "monthly" as const,
      priority: p === "/" ? 1 : 0.6,
    })),
    ...guides,
  ];
}
