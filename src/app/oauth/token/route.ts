/**
 * =============================================================================
 * src/app/oauth/token/route.ts — OAuth 2.0 Access Token Exchange Webhook
 * =============================================================================
 *
 * PATH:
 *   POST /oauth/token
 *
 * PURPOSE:
 *   Handles token exchange requests sent by Amazon's OAuth servers:
 *     - Exchange Auth Code: grant_type = 'authorization_code'
 *     - Refresh Token:      grant_type = 'refresh_token'
 *
 * DETAILED PROTOCOL FLOW:
 *   - Requests carry URL-encoded form data (application/x-www-form-urlencoded).
 *     We read this using Next.js `req.formData()`.
 *   - On success, returns `{ access_token, refresh_token, token_type: 'Bearer', expires_in: 3600 }`.
 *   - On failure, returns standard OAuth error JSON (e.g. invalid_grant) with an HTTP 400.
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, refreshTokens } from '@/lib/alexa/oauth';

export async function POST(req: NextRequest) {
  try {
    // 1. Read URL-encoded form fields (Alexa sends x-www-form-urlencoded)
    const formData = await req.formData();
    
    let grantType = (formData.get('grant_type') as string)?.trim();
    if (grantType) grantType = grantType.replace(/^["']|["']$/g, '');

    let clientId = (formData.get('client_id') as string)?.trim();
    if (clientId) clientId = clientId.replace(/^["']|["']$/g, '');

    let clientSecret = (formData.get('client_secret') as string)?.trim();
    if (clientSecret) clientSecret = clientSecret.replace(/^["']|["']$/g, '');

    // Support client credentials from the standard HTTP Basic Auth header (as per RFC 6749)
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.toLowerCase().startsWith('basic ')) {
      try {
        const base64Credentials = authHeader.substring(6).trim();
        const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
        const parts = credentials.split(':');
        if (parts.length === 2) {
          clientId = parts[0].trim().replace(/^["']|["']$/g, '');
          clientSecret = parts[1].trim().replace(/^["']|["']$/g, '');
        }
      } catch (e) {
        console.error('[OAuth Token API] Failed to parse HTTP Basic Auth header:', e);
      }
    }

    console.log(`[OAuth Token API] Token request received. grant_type: ${grantType}, client_id: ${clientId}`);

    // Validate parameter presence
    if (!grantType || !clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Missing required parameters (grant_type, client_id, client_secret)' },
        { status: 400 }
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  A. AUTHORIZATION CODE GRANT (Exchanging code for tokens)
    // ─────────────────────────────────────────────────────────────────────────
    if (grantType === 'authorization_code') {
      let code = (formData.get('code') as string)?.trim();
      if (code) code = code.replace(/^["']|["']$/g, '');

      let redirectUri = (formData.get('redirect_uri') as string)?.trim();
      if (redirectUri) redirectUri = redirectUri.replace(/^["']|["']$/g, '');

      if (!code || !redirectUri) {
        return NextResponse.json(
          { error: 'invalid_request', error_description: 'Missing parameters for authorization_code grant (code, redirect_uri)' },
          { status: 400 }
        );
      }

      // Delegate to OAuth helper (verifies code, redirect_uri, and deletes code after use)
      const tokenPackage = await exchangeCodeForTokens(code, clientId, clientSecret, redirectUri);

      if (!tokenPackage) {
        return NextResponse.json(
          { error: 'invalid_grant', error_description: 'Invalid or expired authorization code, or client credentials mismatch.' },
          { status: 400 }
        );
      }

      // Return standard OAuth 2.0 success payload
      return NextResponse.json({
        access_token: tokenPackage.access_token,
        refresh_token: tokenPackage.refresh_token,
        token_type: 'Bearer',
        expires_in: tokenPackage.expires_in
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  B. REFRESH TOKEN GRANT (Refreshing expired access tokens)
    // ─────────────────────────────────────────────────────────────────────────
    if (grantType === 'refresh_token') {
      let refreshToken = (formData.get('refresh_token') as string)?.trim();
      if (refreshToken) refreshToken = refreshToken.replace(/^["']|["']$/g, '');

      if (!refreshToken) {
        return NextResponse.json(
          { error: 'invalid_request', error_description: 'Missing refresh_token parameter' },
          { status: 400 }
        );
      }

      // Exchange refresh token for new access and refresh token pair
      const tokenPackage = await refreshTokens(refreshToken, clientId, clientSecret);

      if (!tokenPackage) {
        return NextResponse.json(
          { error: 'invalid_grant', error_description: 'Invalid or expired refresh token, or client credentials mismatch.' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        access_token: tokenPackage.access_token,
        refresh_token: tokenPackage.refresh_token,
        token_type: 'Bearer',
        expires_in: tokenPackage.expires_in
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  C. UNHANDLED GRANT TYPES
    // ─────────────────────────────────────────────────────────────────────────
    return NextResponse.json(
      { error: 'unsupported_grant_type', error_description: `Grant type ${grantType} is not supported.` },
      { status: 400 }
    );

  } catch (err: any) {
    console.error('[OAuth Token API] Unexpected exception in token route:', err.message || err);
    return NextResponse.json(
      { error: 'server_error', error_description: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
