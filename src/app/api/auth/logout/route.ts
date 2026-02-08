import { NextResponse } from 'next/server';
import { logout } from '@/lib/auth/session';
import { logAudit } from '@/lib/audit';

export async function POST() {
  try {
    logAudit('auth_logout');
    await logout();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { success: false, error: 'Logout failed' },
      { status: 500 }
    );
  }
}
