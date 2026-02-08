import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth/session';
import { logAudit } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const { pin } = await request.json();
    const correctPin = process.env.CLAWDIFY_PIN;

    // If no PIN is configured, authentication is disabled
    if (!correctPin) {
      await authenticate();
      return NextResponse.json({ success: true, message: 'No PIN required' });
    }

    // Verify PIN
    if (pin !== correctPin) {
      return NextResponse.json(
        { success: false, error: 'Invalid PIN' },
        { status: 401 }
      );
    }

    // Create session
    await authenticate();
    logAudit('auth_login');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
