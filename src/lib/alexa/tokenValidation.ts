/**
 * =============================================================================
 * src/lib/alexa/tokenValidation.ts — Alexa Bearer Token Verification Module
 * =============================================================================
 *
 * PURPOSE:
 *   Exposes a reusable utility to validate the bearer access tokens passed by
 *   Amazon Alexa in incoming skill directive payloads.
 *
 * HOW IT WORKS:
 *   1. When Alexa calls `/api/alexa`, it passes the access_token in the JSON body.
 *   2. This module queries your Supabase database `oauth_tokens` table.
 *   3. If the token exists and is not expired (expires_at > now()), it returns the
 *      associated user_id (e.g. 'admin').
 *   4. This user_id is then used to retrieve only the devices/relays belonging to
 *      that specific user.
 * =============================================================================
 */

import { supabaseAdmin } from '../supabase';

/**
 * validateAccessToken(token)
 * --------------------------
 * Validates the provided access token against active database records.
 *
 * @param token - The raw access token string (e.g. 'access_...')
 * @returns Promise resolving to the associated user_id (string) if valid, or null.
 */
export async function validateAccessToken(token: string | undefined): Promise<string | null> {
  if (!token || token.trim() === '') {
    console.error('[Token Validation] Validation failed: Token is empty or undefined.');
    return null;
  }

  try {
    // Query token record from Supabase
    const { data: tokenRecord, error } = await supabaseAdmin
      .from('oauth_tokens')
      .select('user_id, expires_at')
      .eq('access_token', token)
      .maybeSingle();

    if (error) {
      console.error('[Token Validation] Database query error:', error.message);
      return null;
    }

    if (!tokenRecord) {
      console.error('[Token Validation] Validation failed: Token not found in database.');
      return null;
    }

    // Check expiration: now() < expires_at
    const isExpired = new Date(tokenRecord.expires_at).getTime() < Date.now();
    if (isExpired) {
      console.error(`[Token Validation] Validation failed: Token expired on ${tokenRecord.expires_at}`);
      
      // Optionally clean up expired access tokens in the background
      await supabaseAdmin.from('oauth_tokens').delete().eq('access_token', token);
      
      return null;
    }

    console.log(`[Token Validation] Token valid. Mapped to user: ${tokenRecord.user_id}`);
    return tokenRecord.user_id;

  } catch (err: any) {
    console.error('[Token Validation] Unexpected exception checking token:', err.message || err);
    return null;
  }
}
