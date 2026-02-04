import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createCheckoutSession } from '@/lib/billing/stripe';
import type { PlanId } from '@/lib/billing/plans';

/**
 * POST /api/billing/checkout
 * Create a Stripe checkout session for upgrading to a paid plan.
 * MOCKED for now — returns a fake session URL.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as { planId?: string };
    const planId = body.planId as PlanId | undefined;

    if (!planId || !['pro'].includes(planId)) {
      return NextResponse.json(
        { error: 'Invalid plan. Must be "pro".' },
        { status: 400 },
      );
    }

    const origin = request.nextUrl.origin;
    const session = await createCheckoutSession({
      userId: user.id,
      email: user.email ?? '',
      planId,
      successUrl: `${origin}/settings/billing?success=true`,
      cancelUrl: `${origin}/settings/billing?canceled=true`,
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[billing/checkout] Error:', err);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 },
    );
  }
}
