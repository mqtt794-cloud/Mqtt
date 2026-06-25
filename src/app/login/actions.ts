/**
 * =============================================================================
 * actions.ts — Static Single-User Authentication Server Actions
 * =============================================================================
 *
 * PURPOSE:
 *   Implements a static single-user login system using credentials embedded
 *   directly in the .env.local configuration (ADMIN_EMAIL & ADMIN_PASSWORD).
 *
 * HOW IT WORKS:
 *   - Verifies the input email and password against the environment values.
 *   - Sets a secure HTTP-Only cookie 'admin_session' upon successful verification.
 *   - Signups are disabled to lock the system to the designated admin.
 * =============================================================================
 */

'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * login(formData)
 * ---------------
 * Validates submitted credentials against static environment values.
 * Sets the authentication cookie on success.
 */
export async function login(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@smarthome.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Suhail1122';

  if (!email || !password) {
    return { error: 'Please enter both email and password.' };
  }

  const cleanInputEmail = email.trim().toLowerCase();
  const cleanAdminEmail = adminEmail.trim().toLowerCase();

  // Verify against env variables
  if (cleanInputEmail === cleanAdminEmail && password === adminPassword) {
    const cookieStore = await cookies();
    const headersList = await headers();
    const isSecure = headersList.get('x-forwarded-proto') === 'https';
    
    // Set a secure, HTTP-only session cookie valid for 7 days
    cookieStore.set('admin_session', 'authenticated', {
      path: '/',
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
    });

    redirect('/dashboard');
  } else {
    return { error: 'Invalid email or password.' };
  }
}

/**
 * signup(formData)
 * ----------------
 * Disabled since this is a private single-user instance.
 */
export async function signup(formData: FormData): Promise<{ error?: string; success?: string }> {
  return { error: 'Registration is disabled on this private controller instance.' };
}

/**
 * logout()
 * --------
 * Deletes the 'admin_session' cookie and redirects to the login screen.
 */
export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete('admin_session');
  redirect('/login');
}
