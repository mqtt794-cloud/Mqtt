/**
 * =============================================================================
 * supabase.ts — Supabase Client Wrapper
 * =============================================================================
 *
 * THREE CLIENTS, THREE PURPOSES:
 * ─────────────────────────────
 *
 * 1. createClientOnBrowser()
 *    ├─ Used in: Client Components ('use client' files, e.g. RelayCard.tsx)
 *    ├─ Key:     NEXT_PUBLIC_SUPABASE_ANON_KEY
 *    └─ Scope:   Respects Row Level Security (RLS). Safe for the browser.
 *
 * 2. createClientOnServer()
 *    ├─ Used in: Server Actions (actions.ts), API Routes (route.ts),
 *    │           Server Components (page.tsx)
 *    ├─ Key:     NEXT_PUBLIC_SUPABASE_ANON_KEY
 *    ├─ Scope:   Respects RLS. Reads/writes HTTP cookies for session handling.
 *    └─ Note:    The cookie plumbing is why this is async.
 *
 * 3. supabaseAdmin / getSupabaseAdmin()
 *    ├─ Used in: BACKGROUND WORKERS ONLY (mqttSubscriber.ts)
 *    ├─ Key:     SUPABASE_SERVICE_ROLE_KEY   ← NOT the anon key
 *    ├─ Scope:   BYPASSES ALL RLS POLICIES. Full database access.
 *    └─ ⚠ NEVER import this into any browser-side file. Never expose the key.
 *
 * WHY "Invalid API key" HAPPENS:
 * ──────────────────────────────
 *   Supabase uses the API key as a JWT. If the value is:
 *     - A placeholder string ("your_service_role_key_here")
 *     - The wrong key (anon key used where service role is needed)
 *     - Empty / undefined
 *   …Supabase returns HTTP 401 with "Invalid API key".
 *
 *   The most common mistake is leaving the placeholder values in .env.local.
 *   Get the real keys from: Supabase Dashboard → Settings → API → Project API keys
 *
 * LAZY INITIALIZATION:
 * ────────────────────
 *   supabaseAdmin is NOT created at module load time. It is created the first
 *   time getSupabaseAdmin() is called. This means:
 *   - If the env vars are missing, you get a clear error with instructions.
 *   - The error appears at startup (via validateSupabaseAdmin()) rather than
 *     silently failing later on the first database write.
 * =============================================================================
 */

import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// ─────────────────────────────────────────────────────────────────────────────
//  1. Browser Client
//  ─────────────────
//  Key: NEXT_PUBLIC_SUPABASE_ANON_KEY (safe to expose — it's public by design)
//  The NEXT_PUBLIC_ prefix tells Next.js to bundle this variable into the
//  browser JavaScript bundle. Without that prefix, browser code gets undefined.
// ─────────────────────────────────────────────────────────────────────────────
export const createClientOnBrowser = () => {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  2. Server Client
//  ────────────────
//  Key: NEXT_PUBLIC_SUPABASE_ANON_KEY
//  Used in Server Actions, API Routes, and Server Components.
//  The cookie handler lets Supabase persist auth sessions across requests.
// ─────────────────────────────────────────────────────────────────────────────
export const createClientOnServer = async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Safe to ignore: Next.js throws if cookies are set in a Server
            // Component render (only Server Actions and Route Handlers can set cookies).
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.delete({ name, ...options });
          } catch {
            // Safe to ignore.
          }
        },
      },
    }
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  3. Admin Client (lazy singleton)
//  ─────────────────────────────────
//  Key: SUPABASE_SERVICE_ROLE_KEY
//      (NO NEXT_PUBLIC_ prefix — never sent to the browser)
//
//  This client bypasses Row Level Security. The MQTT subscriber uses it to:
//    - Insert newly discovered devices into device_registry
//    - Update device online/offline status
//    - Write relay state snapshots
//    - Log MQTT events into device_events
//
//  WHY LAZY? The admin client is created on first use, not at import time.
//  This lets validateSupabaseAdmin() run first and give a clear error if the
//  env vars are placeholders/missing.
// ─────────────────────────────────────────────────────────────────────────────
let _adminClient: SupabaseClient | null = null;

/**
 * getSupabaseAdmin()
 * ------------------
 * Returns the singleton admin Supabase client.
 * Creates it on first call, reuses it on subsequent calls.
 *
 * Throws a descriptive error if the required environment variables are missing.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (_adminClient) {
    return _adminClient; // Already created — return the cached instance
  }

  const url            = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // ── Fail-fast validation ──────────────────────────────────────────────────
  if (!url || url.trim() === '') {
    throw new Error(
      '[Supabase Admin] NEXT_PUBLIC_SUPABASE_URL is not set.\n' +
      '  → Go to: Supabase Dashboard → Settings → API → Project URL\n' +
      '  → Add to .env.local:  NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co'
    );
  }

  if (!serviceRoleKey || serviceRoleKey.trim() === '' || serviceRoleKey.startsWith('your_')) {
    throw new Error(
      '[Supabase Admin] SUPABASE_SERVICE_ROLE_KEY is not set or is still a placeholder.\n' +
      '  → Go to: Supabase Dashboard → Settings → API → Project API keys → service_role (secret)\n' +
      '  → Add to .env.local:  SUPABASE_SERVICE_ROLE_KEY=eyJ...\n' +
      '  ⚠ Do NOT use the anon key here. The service role key starts with "eyJ" and is much longer.\n' +
      '  ⚠ Do NOT add NEXT_PUBLIC_ prefix — this key must NEVER reach the browser.'
    );
  }

  // ── Create the client ─────────────────────────────────────────────────────
  _adminClient = createSupabaseClient(url, serviceRoleKey, {
    auth: {
      // Disable automatic session management — this is a server-side service account,
      // it does not log in as a user and does not need session persistence.
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _adminClient;
}

/**
 * validateSupabaseAdmin()
 * -----------------------
 * Call this once at startup (in mqttSubscriber.ts or instrumentation.ts) to
 * verify the admin client can be created and actually reach the database.
 *
 * Logs a detailed debug report and returns false if anything is wrong,
 * so the caller can bail out early with a clear message.
 */
export async function validateSupabaseAdmin(): Promise<boolean> {
  console.log('[Supabase Admin] ── Startup Validation ───────────────────────────');

  // ── 1. Environment variable checks ───────────────────────────────────────
  const url            = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey        = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log(`[Supabase Admin]   NEXT_PUBLIC_SUPABASE_URL      : ${url ?? '❌ NOT SET'}`);
  console.log(`[Supabase Admin]   SUPABASE_SERVICE_ROLE_KEY     : ${
    !serviceRoleKey             ? '❌ NOT SET' :
    serviceRoleKey.startsWith('your_') ? '❌ STILL A PLACEHOLDER' :
    serviceRoleKey.length < 100 ? '⚠  SET but suspiciously short (is this really the service role key?)' :
    '✅ Set (' + serviceRoleKey.slice(0, 12) + '...)'
  }`);
  console.log(`[Supabase Admin]   NEXT_PUBLIC_SUPABASE_ANON_KEY : ${
    !anonKey             ? '❌ NOT SET' :
    anonKey.startsWith('your_') ? '❌ STILL A PLACEHOLDER' :
    '✅ Set (' + anonKey.slice(0, 12) + '...)'
  }`);

  // ── 2. Common mistake warning ─────────────────────────────────────────────
  if (serviceRoleKey && anonKey && serviceRoleKey === anonKey) {
    console.error('[Supabase Admin] ❌ CRITICAL: SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_ANON_KEY are the same value!');
    console.error('[Supabase Admin]    The service role key and anon key are different keys. Check your Supabase Dashboard → Settings → API.');
    return false;
  }

  // ── 3. Try to create the admin client (will throw if env vars are bad) ───
  let client: SupabaseClient;
  try {
    client = getSupabaseAdmin();
    console.log('[Supabase Admin]   Client created               : ✅ OK');
  } catch (err: any) {
    console.error('[Supabase Admin] ❌ Failed to create admin client:');
    console.error(err.message);
    return false;
  }

  // ── 4. Live connection test — query a known table ────────────────────────
  console.log('[Supabase Admin]   Running connection test...');
  try {
    const { error } = await client.from('device_registry').select('device_id').limit(1);

    if (error) {
      console.error(`[Supabase Admin] ❌ Connection test FAILED: ${error.message}`);
      console.error(`[Supabase Admin]   Code: ${error.code} | Hint: ${error.hint ?? 'none'}`);

      // Give specific advice for the most common error
      if (error.message.toLowerCase().includes('invalid api key') || error.code === '401') {
        console.error('[Supabase Admin]   ──────────────────────────────────────────────────');
        console.error('[Supabase Admin]   "Invalid API key" means one of these problems:');
        console.error('[Supabase Admin]     1. SUPABASE_SERVICE_ROLE_KEY is still a placeholder (your_service_role_key_here)');
        console.error('[Supabase Admin]     2. You used the anon key instead of the service_role key');
        console.error('[Supabase Admin]     3. The key was copied with extra spaces or line breaks');
        console.error('[Supabase Admin]   Fix: Supabase Dashboard → Settings → API → service_role (secret)');
        console.error('[Supabase Admin]   ──────────────────────────────────────────────────');
      }
      return false;
    }

    console.log('[Supabase Admin]   Connection test               : ✅ SUCCESS (reached device_registry table)');
  } catch (err: any) {
    console.error(`[Supabase Admin] ❌ Connection test threw an exception: ${err.message}`);
    return false;
  }

  console.log('[Supabase Admin] ─────────────────────────────────────────────────');
  console.log('[Supabase Admin] ✅ Admin client is fully operational.');
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Backward-compatible export
//  ──────────────────────────
//  Previously, code imported `supabaseAdmin` directly as a pre-built object.
//  This export keeps that working without changing every import site.
//  It is a Proxy that creates the real client on first property access.
// ─────────────────────────────────────────────────────────────────────────────
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    // getSupabaseAdmin() creates the client on first access and validates env vars
    return getSupabaseAdmin()[prop as keyof SupabaseClient];
  },
});
