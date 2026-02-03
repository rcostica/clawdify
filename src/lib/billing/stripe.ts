/**
 * Stripe integration layer (MOCKED for now).
 *
 * Structure is ready for real Stripe integration.
 * Replace mock implementations with actual Stripe SDK calls when ready.
 *
 * 🔒 SECURITY: This file should only be imported on the server side.
 * Client components should call API routes instead.
 */

import type { PlanId } from './plans';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CheckoutSession {
  id: string;
  url: string;
}

export interface PortalSession {
  id: string;
  url: string;
}

export interface SubscriptionInfo {
  id: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  planId: PlanId;
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

// ─── Price IDs (placeholder — replace with real Stripe price IDs) ────────────

const PRICE_IDS: Record<PlanId, string | null> = {
  free: null,
  pro: 'price_mock_pro_monthly',
  team: 'price_mock_team_monthly',
};

// ─── Mock Stripe Client ──────────────────────────────────────────────────────

/**
 * Create a Stripe checkout session for upgrading to a paid plan.
 * MOCKED: Returns a fake session URL.
 */
export async function createCheckoutSession(params: {
  userId: string;
  email: string;
  planId: PlanId;
  successUrl: string;
  cancelUrl: string;
}): Promise<CheckoutSession> {
  const priceId = PRICE_IDS[params.planId];
  if (!priceId) {
    throw new Error(`No price configured for plan: ${params.planId}`);
  }

  console.log('[stripe] Creating checkout session (mocked):', {
    userId: params.userId,
    email: params.email,
    planId: params.planId,
    priceId,
  });

  // Mock: In production, this would call stripe.checkout.sessions.create()
  return {
    id: `cs_mock_${Date.now()}`,
    url: `${params.successUrl}?session_id=cs_mock_${Date.now()}&plan=${params.planId}`,
  };
}

/**
 * Create a Stripe billing portal session for managing subscriptions.
 * MOCKED: Returns a fake portal URL.
 */
export async function createPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<PortalSession> {
  console.log('[stripe] Creating portal session (mocked):', {
    customerId: params.customerId,
  });

  // Mock: In production, this would call stripe.billingPortal.sessions.create()
  return {
    id: `bps_mock_${Date.now()}`,
    url: `${params.returnUrl}?portal=mock`,
  };
}

/**
 * Get subscription info for a customer.
 * MOCKED: Returns a fake active subscription.
 */
export async function getSubscription(
  subscriptionId: string,
): Promise<SubscriptionInfo | null> {
  console.log('[stripe] Getting subscription (mocked):', subscriptionId);

  if (!subscriptionId || subscriptionId === 'null') {
    return null;
  }

  // Mock response
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  return {
    id: subscriptionId,
    status: 'active',
    planId: 'pro',
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: periodEnd.toISOString(),
  };
}

/**
 * Verify a Stripe webhook signature.
 * MOCKED: Always returns true.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
): boolean {
  console.log('[stripe] Verifying webhook signature (mocked)', {
    payloadLength: payload.length,
    signature: signature.slice(0, 20) + '...',
  });

  // Mock: In production, use stripe.webhooks.constructEvent()
  return true;
}
