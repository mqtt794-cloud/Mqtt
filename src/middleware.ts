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

// Zero-dependency in-memory rate limiter cache
const ipCache = new Map<string, number[]>();
const LIMIT = 10; // 10 requests
const WINDOW = 60 * 1000; // 1 minute window

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = ipCache.get(ip) || [];
  
  // Filter out timestamps older than the window
  const activeTimestamps = timestamps.filter(t => now - t < WINDOW);
  
  if (activeTimestamps.length >= LIMIT) {
    return true;
  }
  
  activeTimestamps.push(now);
  ipCache.set(ip, activeTimestamps);
  return false;
}

export function middleware(request: NextRequest) {
  const session = request.cookies.get('admin_session')?.value;
  const { pathname } = request.nextUrl;

  // Rate limiting for auth and control endpoints (POST requests only)
  if (request.method === 'POST') {
    if (pathname === '/login' || pathname === '/oauth/token' || pathname.startsWith('/api/device/control')) {
      const ip = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
      if (isRateLimited(ip)) {
        return new NextResponse(
          JSON.stringify({ error: 'Too many requests. Please try again in a minute.' }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  }

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
    '/api/device/control',
    '/login',
    '/oauth/token',
  ],
};
