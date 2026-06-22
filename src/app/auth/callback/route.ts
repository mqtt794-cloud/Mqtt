/**
 * =============================================================================
 * route.ts — Supabase Email Verification Callback
 * =============================================================================
 *
 * PATH:
 *   GET /auth/callback
 *
 * PURPOSE:
 *   Handles email verification redirect links from Supabase Auth.
 *   Exchanges the temporary `code` query parameter for a permanent session cookie,
 *   then redirects the user to their dashboard.
 * =============================================================================
 */

import { NextResponse } from 'next/server';
import { createClientOnServer } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClientOnServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // Session successfully established in cookies. Send user to next page
      return NextResponse.redirect(`${origin}${next}`);
    } else {
      console.error('[Auth Callback] Session exchange failed:', error);
    }
  }

  // If validation fails, return to login with error feedback
  return NextResponse.redirect(`${origin}/login?error=Could not exchange auth code for session`);
}
