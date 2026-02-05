import { NextResponse, type NextRequest } from 'next/server';

export function middleware(_request: NextRequest) {
  // No auth required - self-hosted single-user app
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
