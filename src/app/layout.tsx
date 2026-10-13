import type { Metadata } from "next";
import { connection } from "next/server";
import { Fraunces, Geist } from "next/font/google";
import "./globals.css";
import { BRAND } from "@/lib/brand";
import { RouteProgress } from "@/components/route-progress";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// REQ-014: the heading serif, self-hosted at build time by next/font so no
// external origin is added to the CSP (AC-2). Variable weight with the
// optical-size axis; the stylesheet sets weight 500 and opsz 48 on headings.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: `${BRAND}: registration-readiness for small NDIS providers`,
    template: `%s | ${BRAND}`,
  },
  description:
    "Tailored policies, a Practice Standards self-assessment and a readiness checklist for sole-trader and small NDIS providers preparing for registration. General information, prepared for your review.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Every HTML response is rendered per request so the CSP nonce issued by
  // src/proxy.ts matches the scripts in the page (REQ-002, D-202). A static
  // shell would carry build-time markup with no nonce and be blocked.
  await connection();
  return (
    <html
      lang="en-AU"
      className={`${geistSans.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="bg-paper text-ink flex min-h-full flex-col">
        <a
          href="#main-content"
          className="focus:bg-paper focus:text-ink sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:px-3 focus:py-2 focus:outline-2"
        >
          Skip to main content
        </a>
        {/* REQ-015 FR-14: the line across the top while the next page loads. */}
        <RouteProgress />
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
