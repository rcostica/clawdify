import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getIronSession, SessionOptions } from 'iron-session';

interface SessionData {
  isAuthenticated: boolean;
  authenticatedAt?: number;
}

const sessionOptions: SessionOptions = {
  password: process.env.CLAWDIFY_SESSION_SECRET || 'complex_password_at_least_32_characters_long',
  cookieName: 'clawdify_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict' as const,
  },
};

// Routes that don't require authentication
const publicRoutes = ['/login', '/api/'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow static files
  if (pathname.startsWith('/_next') || pathname.includes('.')) {
    return NextResponse.next();
  }

  // Check if PIN is configured
  const pin = process.env.CLAWDIFY_PIN;
  if (!pin) {
    // No PIN configured - allow access (relies on Tailscale for security)
    return NextResponse.next();
  }

  // Check session
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, sessionOptions);

  if (!session.isAuthenticated) {
    // Redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
