import type { MetadataRoute } from "next";
import { buildGroupPages } from "@/lib/guides/groups";
import { listGuideSlugs, loadGuide } from "@/lib/guides/pages";
import { LEGAL_NAV } from "@/lib/legal/nav";
import { siteUrl } from "@/lib/site";
import { getStandardsDataset } from "@/lib/standards/dataset";

/** The public pages, the guides and the 38 registration-group pages (REQ-011); signed-in pages are left out and disallowed in robots. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const dataset = getStandardsDataset();
  const fixed = [
    ...new Set([
      "/",
      "/start",
      "/pricing",
      "/guides",
      "/guides/registration-groups",
      ...LEGAL_NAV.map((l) => l.href),
    ]),
  ];
  const groups = buildGroupPages(dataset).map((p) => ({
    url: `${base}/guides/registration-groups/${p.slug}`,
    lastModified: dataset.generatedAt.slice(0, 10),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));
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
    ...groups,
  ];
}
