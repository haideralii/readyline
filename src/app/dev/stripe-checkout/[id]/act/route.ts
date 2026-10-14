import { NextResponse } from "next/server";
import { parseInput } from "@/lib/validation";
import {
  FakeCheckoutInput,
  runFakeCheckout,
} from "@/server/payments/fake-checkout";
import { readStripeEnv, StripeEnvError } from "@/server/payments/stripe";

export const dynamic = "force-dynamic";

/**
 * Where the fake Checkout's forms post (REQ-007 Q5, D-709): 404 outside fake
 * mode, same-origin posts only. Batch 45b item 2: the answer is a 303, so the
 * return to the site is a full page load, as Stripe's own return is. The
 * server action this replaces redirected with a soft navigation, which left
 * the root layout, and the next-step strip in it, as rendered before the
 * purchase existed (CI run 571: the strip still said "buy" on the landing).
 */
export async function POST(
  request: Request,
  { params }: RouteContext<"/dev/stripe-checkout/[id]/act">,
) {
  let env;
  try {
    env = readStripeEnv();
  } catch (e) {
    if (e instanceof StripeEnvError)
      return new NextResponse(null, { status: 404 });
    throw e;
  }
  if (!env.fake) return new NextResponse(null, { status: 404 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return new NextResponse(null, { status: 403 });
  const { id } = await params;
  const form = await request.formData();
  // The only input read here is the pressed button; its shape is checked
  // through the validation layer (REQ-002 FR-3) before anything runs.
  const parsed = parseInput(FakeCheckoutInput, {
    id,
    action: form.get("action"),
  });
  const to = parsed.ok ? await runFakeCheckout(parsed.data) : null;
  return NextResponse.redirect(new URL(to ?? "/", request.url), 303);
}
