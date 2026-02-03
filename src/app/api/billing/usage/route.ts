import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/billing/usage
 * Return usage stats for the current user in the current billing period.
 * MOCKED for now — returns fake data.
 *
 * In production: query usage_logs table aggregated by billing period.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Mock usage data
    // In production: query usage_logs table
    // SELECT SUM(tokens_in), SUM(tokens_out) FROM usage_logs
    // WHERE user_id = $1 AND created_at >= $periodStart

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const mockUsage = {
      tokensIn: 124_350,
      tokensOut: 48_200,
      cost: 2.47,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      breakdown: [
        { model: 'claude-sonnet', tokensIn: 89_200, tokensOut: 35_100, cost: 1.82 },
        { model: 'gpt-4o', tokensIn: 35_150, tokensOut: 13_100, cost: 0.65 },
      ],
    };

    return NextResponse.json(mockUsage);
  } catch (err) {
    console.error('[billing/usage] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch usage data' },
      { status: 500 },
    );
  }
}
