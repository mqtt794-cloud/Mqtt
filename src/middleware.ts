/**
 * =============================================================================
 * middleware.ts — Static Session Routing Middleware
 * =============================================================================
 *
 * PURPOSE:
 *   Validates the HTTP-Only 'admin_session' cookie on protected routes.
 *   - If an unauthenticated user attempts to visit the dashboard or api routes,
 *     redirects them immediately to `/login`.
 *   - If an already logged-in user visits the login portal, redirects them to
 *     `/dashboard` to keep user navigation seamless.
 * =============================================================================
 */

import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('admin_session')?.value;
  const { pathname } = request.nextUrl;

  // Protect dashboard and API paths
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/api/device/control')) {
    if (session !== 'authenticated') {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Redirect authenticated administrators away from the login screen
  if (pathname === '/login') {
    if (session === 'authenticated') {
      const dashboardUrl = new URL('/dashboard', request.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return NextResponse.next();
}

// Specify matcher to intercept target paths
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/device/control/:path*',
    '/login',
  ],
};
