/**
 * =============================================================================
 * src/app/oauth/authorize/actions.ts — OAuth Authorization Server Actions
 * =============================================================================
 *
 * PURPOSE:
 *   Handles credentials verification and OAuth redirect logic on the server.
 *
 * HOW IT WORKS:
 *   1. Compares user-entered login credentials against the ADMIN variables.
 *   2. Validates that the Alexa clientId matches our configured value.
 *   3. Calls the OAuth service to insert a new 5-minute auth code.
 *   4. Redirects the user's browser back to Alexa's redirect_uri with the
 *      code and state parameters, completing the authorization stage.
 * =============================================================================
 */

'use server';

import { redirect } from 'next/navigation';
import { createAuthCode } from '@/lib/alexa/oauth';

export interface AuthorizeResult {
  error?: string;
}

/**
 * handleAuthorize(formData)
 * -------------------------
 * Server Action to validate the credentials and perform the external redirect.
 */
export async function handleAuthorize(
  prevState: any,
  formData: FormData
): Promise<AuthorizeResult> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const clientId = formData.get('clientId') as string;
  const redirectUri = formData.get('redirectUri') as string;
  const state = formData.get('state') as string;

  // 1. Basic validation
  if (!email || !password) {
    return { error: 'Please enter both email and password.' };
  }

  if (!clientId || !redirectUri || !state) {
    return { error: 'OAuth query parameters (client_id, redirect_uri, state) are missing.' };
  }

  // 2. Validate Client ID
  const expectedClientId = process.env.ALEXA_CLIENT_ID || 'alexa-smart-home-skill';
  if (clientId !== expectedClientId) {
    console.error(`[OAuth Auth] Client ID mismatch. Expected: ${expectedClientId}, Got: ${clientId}`);
    return { error: 'Invalid client ID. Please check your Alexa Skill configuration.' };
  }

  // 3. Validate user credentials
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@smarthome.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Suhail1122';

  if (email.trim() !== adminEmail || password !== adminPassword) {
    console.warn(`[OAuth Auth] Failed login attempt for email: ${email}`);
    return { error: 'Invalid email or password.' };
  }

  // 4. Generate Authorization Code and save to DB
  let code: string;
  try {
    code = await createAuthCode('admin', redirectUri);
  } catch (err: any) {
    console.error('[OAuth Auth] Error generating auth code:', err);
    return { error: 'A database error occurred. Please try again.' };
  }

  // 5. Perform external redirect to Alexa's Callback URL
  //    Format: {redirectUri}?code={code}&state={state}
  const redirectUrl = `${redirectUri}${redirectUri.includes('?') ? '&' : '?'}code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
  
  console.log(`[OAuth Auth] Redirecting user back to Alexa redirect_uri: ${redirectUri}`);
  
  redirect(redirectUrl);
}
