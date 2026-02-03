import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/billing/webhook
 * Handle Stripe webhooks.
 * MOCKED for now — logs the event and returns 200.
 *
 * In production:
 * 1. Verify webhook signature with Stripe SDK
 * 2. Handle events: checkout.session.completed, customer.subscription.updated, etc.
 * 3. Update user plan in Supabase profiles table
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature') ?? '';

    // Mock: In production, verify signature
    console.log('[billing/webhook] Received webhook:', {
      bodyLength: body.length,
      signature: signature.slice(0, 20) || '(none)',
    });

    // Mock: Parse event and handle
    let event: { type?: string; data?: { object?: Record<string, unknown> } };
    try {
      event = JSON.parse(body) as typeof event;
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 },
      );
    }

    const eventType = event.type ?? 'unknown';

    switch (eventType) {
      case 'checkout.session.completed':
        console.log('[billing/webhook] Checkout completed:', event.data?.object);
        // TODO: Update user plan in Supabase
        // const userId = event.data.object.client_reference_id;
        // const subscriptionId = event.data.object.subscription;
        // await supabase.from('profiles').update({ plan: 'pro', stripe_subscription_id: subscriptionId }).eq('id', userId);
        break;

      case 'customer.subscription.updated':
        console.log('[billing/webhook] Subscription updated:', event.data?.object);
        // TODO: Handle plan changes, cancellations
        break;

      case 'customer.subscription.deleted':
        console.log('[billing/webhook] Subscription deleted:', event.data?.object);
        // TODO: Downgrade user to free plan
        break;

      default:
        console.log(`[billing/webhook] Unhandled event type: ${eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[billing/webhook] Error:', err);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 },
    );
  }
}
