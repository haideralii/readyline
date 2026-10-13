import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/** Crawlers may read the public pages and the guides; account, checklist, documents, registers and the API are private (REQ-011). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/account",
          "/checklist",
          "/documents",
          "/registers",
          "/admin",
          "/api/",
          "/dev/",
          "/auth/",
        ],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
