import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth/session';

export async function GET() {
  try {
    const authenticated = await isAuthenticated();
    const pinRequired = !!process.env.CLAWDIFY_PIN;

    return NextResponse.json({
      authenticated: authenticated || !pinRequired,
      pinRequired,
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { authenticated: false, pinRequired: true, error: 'Check failed' },
      { status: 500 }
    );
  }
}
