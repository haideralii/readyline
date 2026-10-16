import Link from "next/link";
import {
  AI_DISCLOSURE,
  BRAND,
  GENERAL_INFORMATION_STATEMENT,
} from "@/lib/brand";
import { businessAbn, contactEmail } from "@/lib/legal/config";
import { LEGAL_NAV } from "@/lib/legal/nav";

/**
 * Footer on every page (REQ-008 FR-2): the legal and trust links, the
 * general-information and AI statements, hosting and independence lines,
 * the contact address when `CONTACT_EMAIL` is set and the ABN when
 * `BUSINESS_ABN` is set. Server component: the two values never reach the
 * client bundle.
 */
export function SiteFooter() {
  const email = contactEmail();
  const abn = businessAbn();
  const link =
    "inline-flex min-h-11 items-center underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2";
  return (
    <footer className="border-rule bg-mist mt-auto border-t">
      <div
        data-shell="footer"
        className="text-slate mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm sm:px-6 lg:px-8"
      >
        <nav aria-label="Legal and about" data-testid="footer-nav">
          <ul className="flex flex-wrap gap-x-6 gap-y-1">
            {LEGAL_NAV.map((item) => (
              <li key={item.slug}>
                <Link href={item.href} className={link}>
                  {item.label}
                </Link>
              </li>
            ))}
            {email ? (
              <li>
                <a
                  href={`mailto:${email}`}
                  className={link}
                  data-testid="footer-contact"
                >
                  Contact
                </a>
              </li>
            ) : null}
          </ul>
        </nav>
        {/* Independence is stated once, in the trust line below (PO review of REQ-008). */}
        <p data-testid="site-disclaimer">{GENERAL_INFORMATION_STATEMENT}</p>
        <p data-testid="ai-disclosure">{AI_DISCLOSURE}</p>
        <p data-testid="footer-trust">
          Hosted in Australia. Independent of the NDIA and the NDIS Quality and
          Safeguards Commission.
        </p>
        <p className="text-sm" data-testid="footer-brand">
          {BRAND}
          {abn ? ` (ABN ${abn})` : ""}. NDIS is a registered trade mark of the
          National Disability Insurance Agency and is used here descriptively
          only.
        </p>
      </div>
    </footer>
  );
}
