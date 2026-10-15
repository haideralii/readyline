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
import { loadLegalPage, type LegalSlug } from "@/lib/legal/pages";
import { renderLegalTokens } from "@/lib/legal/tokens";
import { SUBSCRIPTION_OFF } from "@/lib/payments/copy";
import { subscriptionAvailable } from "@/server/payments/stripe";

export function renderedLegalPage(slug: LegalSlug) {
  const name = businessName();
  const abn = businessAbn();
  return renderLegalTokens(loadLegalPage(slug), {
    subscriptionOffered: subscriptionAvailable(),
    businessLine: name && abn ? HOME_COPY.missionRegistered(name, abn) : null,
    subscriptionOff: SUBSCRIPTION_OFF,
  });
}
