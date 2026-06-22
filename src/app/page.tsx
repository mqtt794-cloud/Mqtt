/**
 * =============================================================================
 * page.tsx — Root Routing Page (Static Auth Version)
 * =============================================================================
 *
 * PURPOSE:
 *   Validates the user's static 'admin_session' cookie on the server-side.
 *   - If authenticated: redirects them to `/dashboard`.
 *   - If guest: redirects them to `/login`.
 * =============================================================================
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function Home() {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session')?.value;

  if (session === 'authenticated') {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}
