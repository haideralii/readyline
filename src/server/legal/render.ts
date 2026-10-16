import "server-only";
/**
 * A legal page with its runtime tokens filled (batch 47 items 1 and 2): the
 * registered name and ABN sentence once both are set, and the subscription's
 * off-state sentence while STRIPE_PRICE_REGISTERS is unset. The route pages
 * call this instead of loadLegalPage so no public page shows a placeholder
 * or contradicts the pricing page.
 */
import { HOME_COPY } from "@/lib/home-copy";
import { businessAbn, businessName } from "@/lib/legal/config";
import {
  formatUpdated,
  loadLegalPage,
  type LegalSlug,
} from "@/lib/legal/pages";
import { renderLegalTokens } from "@/lib/legal/tokens";
import { vendorTermsDate } from "@/lib/legal/vendor-terms";
import { SUBSCRIPTION_OFF } from "@/lib/payments/copy";
import { subscriptionAvailable } from "@/server/payments/stripe";

export function renderedLegalPage(slug: LegalSlug) {
  const name = businessName();
  const abn = businessAbn();
  const page = loadLegalPage(slug);
  // REQ-022 Session E (D-2258, D-2248): the day the vendors' terms were read
  // is the lawyer's bundle index's date; until a bundle is built it is the
  // page's own date, so the sentence never shows raw braces.
  return renderLegalTokens(page, {
    subscriptionOffered: subscriptionAvailable(),
    businessLine: name && abn ? HOME_COPY.missionRegistered(name, abn) : null,
    subscriptionOff: SUBSCRIPTION_OFF,
    vendorTermsDate: formatUpdated(vendorTermsDate() ?? page.updated),
  });
}
