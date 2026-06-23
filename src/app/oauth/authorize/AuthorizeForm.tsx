/**
 * =============================================================================
 * src/app/oauth/authorize/AuthorizeForm.tsx — OAuth Auth Form Client Component
 * =============================================================================
 *
 * PURPOSE:
 *   Renders the login UI for Alexa account linking.
 *   This component reads the OAuth parameters passed in the query string:
 *     - client_id
 *     - redirect_uri
 *     - state
 *     - response_type
 *   And provides a beautiful dark-mode interface matching your home dashboard.
 * =============================================================================
 */

'use client';

import { useSearchParams } from 'next/navigation';
import { useActionState } from 'react';
import { handleAuthorize, AuthorizeResult } from './actions';
import { KeyRound, ShieldAlert, Cpu } from 'lucide-react';

const initialState: AuthorizeResult = {};

export default function AuthorizeForm() {
  const searchParams = useSearchParams();

  // Read the query parameters sent by Amazon Alexa's OAuth server
  const clientId = searchParams.get('client_id');
  const redirectUri = searchParams.get('redirect_uri');
  const state = searchParams.get('state');
  const responseType = searchParams.get('response_type');

  // Next.js 15 form action state hook
  const [formState, action, isPending] = useActionState(handleAuthorize, initialState);

  // Validate parameters presence on the client side
  const hasParams = clientId && redirectUri && state && responseType === 'code';

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 font-sans select-none">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
        {/* Header Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-4 bg-indigo-950/40 rounded-2xl border border-indigo-500/20 text-indigo-400">
            <Cpu className="w-8 h-8 animate-pulse" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Alexa Linkage</h1>
          <p className="text-slate-400 text-sm">
            Link your smart home controller with your Amazon Alexa account.
          </p>
        </div>

        {/* Validation Errors for OAuth query params */}
        {!hasParams ? (
          <div className="p-4 bg-red-950/30 border border-red-500/20 rounded-2xl flex items-start gap-3 text-red-400">
            <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <h4 className="font-bold">OAuth Parameter Error</h4>
              <p className="mt-1 text-xs text-red-400/80 leading-relaxed">
                Alexa parameters are missing or invalid. Check that your skill's Account Linking config
                contains `client_id`, `response_type=code`, `redirect_uri`, and `state`.
              </p>
            </div>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            {/* Hidden OAuth params passed to Server Action */}
            <input type="hidden" name="clientId" value={clientId} />
            <input type="hidden" name="redirectUri" value={redirectUri} />
            <input type="hidden" name="state" value={state} />

            {/* Email Address */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Administrator Email
              </label>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="admin@smarthome.com"
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Security Password
              </label>
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                placeholder="••••••••••••"
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Error Feedback */}
            {formState?.error && (
              <div className="p-3 bg-red-950/30 border border-red-500/20 text-red-400 rounded-xl text-sm font-medium">
                {formState.error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl active:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer mt-6"
            >
              {isPending ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  Link Account
                </>
              )}
            </button>
          </form>
        )}
        
        {/* Footer info */}
        <div className="text-center text-xs text-slate-500">
          Private single-user instance. Bypasses external authentication providers.
        </div>
      </div>
    </div>
  );
}
