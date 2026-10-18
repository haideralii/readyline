import type { Metadata } from "next";
import { connection } from "next/server";
import { Fraunces, Geist } from "next/font/google";
import "./globals.css";
import { BRAND } from "@/lib/brand";
import { NextStepStrip } from "@/components/next-step-strip";
import { RouteProgress } from "@/components/route-progress";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

// Backlog 2 (D-1012): both fonts use `display: optional`. With `swap`, the
// largest text on every page painted once in the fallback and again when
// the font arrived, which Lighthouse's mobile profile measured as a 3 s
// largest contentful paint; with `optional` the first paint is the final one
// (the metric-matched fallback shows on a slow first visit, the self-hosted
// font on every visit after), and nothing shifts.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "optional",
});

// REQ-014: the heading serif, self-hosted at build time by next/font so no
// external origin is added to the CSP (AC-2). Variable weight with the
// optical-size axis; the stylesheet sets weight 500 and opsz 48 on headings.
// Not preloaded (D-1012): its 68 kB competed with the render-blocking
// stylesheet on a throttled link and held the first paint back by about
// half a second on every page. With `optional` it is fetched after the first
// paint and applies from the next page on (and on a fast first visit); the
// very first page view of a slow visit shows the metric-matched fallback.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "optional",
  preload: false,
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
          // REQ-031 FR-2 (AC-5): no link in print, the skip link included.
          className="focus:bg-ink focus:text-paper sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:px-3 focus:py-2 focus:outline-2 print:hidden"
        >
          Skip to main content
        </a>
        {/* REQ-015 FR-14: the line across the top while the next page loads. */}
        <RouteProgress />
        <SiteHeader />
        {/* REQ-017 FR-1: one sentence and one button on every signed-in page. */}
        <NextStepStrip />
        <main id="main-content" tabIndex={-1} className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
