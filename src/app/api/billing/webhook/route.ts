import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/billing/webhook
 * Handle Stripe webhooks.
 *
 * 🔒 SECURITY: This endpoint is NOT production-ready.
 * Stripe webhook signature verification is required before enabling.
 * The endpoint returns 503 to prevent exploitation if accidentally deployed.
 *
 * Production implementation checklist:
 * 1. Install Stripe SDK: `npm install stripe`
 * 2. Set STRIPE_WEBHOOK_SECRET in environment variables
 * 3. Use stripe.webhooks.constructEvent() to verify signatures
 * 4. Handle events: checkout.session.completed, customer.subscription.updated, etc.
 * 5. Update user plan in Supabase profiles table
 */
export async function POST(request: NextRequest) {
  // 🔒 SECURITY: Reject all webhook requests until Stripe signature
  // verification is implemented. This prevents fake webhook attacks.
  const isStripeConfigured = !!process.env.STRIPE_WEBHOOK_SECRET;

  if (!isStripeConfigured) {
    return NextResponse.json(
      {
        error: 'Webhook endpoint not configured',
        message: 'Stripe webhook signature verification is not set up. ' +
          'Set STRIPE_WEBHOOK_SECRET environment variable.',
      },
      { status: 503 },
    );
  }

  // When Stripe is configured, verify the webhook signature
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 },
      );
    }

    // TODO: Implement actual Stripe signature verification:
    //
    // import Stripe from 'stripe';
    // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    // const event = stripe.webhooks.constructEvent(
    //   body,
    //   signature,
    //   process.env.STRIPE_WEBHOOK_SECRET!,
    // );
    //
    // switch (event.type) {
    //   case 'checkout.session.completed': { ... }
    //   case 'customer.subscription.updated': { ... }
    //   case 'customer.subscription.deleted': { ... }
    // }

    return NextResponse.json(
      { error: 'Webhook handler not yet implemented' },
      { status: 503 },
    );
  } catch (err) {
    // 🔒 SECURITY: Don't leak internal error details
    console.error('[billing/webhook] Error processing webhook');
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 400 },
    );
  }
}
