import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    // 🔒 SECURITY: Handle exchange failures explicitly instead of silently
    // redirecting. Failed exchanges could indicate expired codes, replay
    // attacks, or PKCE mismatch.
    if (error) {
      console.error('[auth/callback] Code exchange failed:', error.message);
      const loginUrl = new URL('/login', origin);
      loginUrl.searchParams.set('error', 'auth_callback_failed');
      return NextResponse.redirect(loginUrl.toString());
    }
  } else {
    // No code provided — redirect to login
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('error', 'missing_code');
    return NextResponse.redirect(loginUrl.toString());
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
