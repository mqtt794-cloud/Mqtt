/**
 * =============================================================================
 * page.tsx — Authentication Portal Page
 * =============================================================================
 *
 * PURPOSE:
 *   Provides the Sign In and Registration forms. Supports toggling between
 *   sign-in and signup flows. Leverages Server Actions for secure operations.
 *
 * UX/DESIGN DECISIONS:
 *   - Sleek dark theme matching our smart home aesthetic.
 *   - Glassmorphic card overlay with dynamic validation feedbacks.
 *   - Mobile-first with large touch targets.
 * =============================================================================
 */

'use client';

import { useState } from 'react';
import { login, signup } from './actions';
import { Shield, Sparkles, Cpu } from 'lucide-react';

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Form submission handler
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    try {
      if (isSignUp) {
        const response = await signup(formData);
        if (response?.error) {
          setErrorMessage(response.error);
        } else if (response?.success) {
          setSuccessMessage(response.success);
        }
      } else {
        const response = await login(formData);
        if (response?.error) {
          setErrorMessage(response.error);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background ambient glowing details */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-900/10 rounded-full blur-3xl animate-fade-in" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-950/10 rounded-full blur-3xl animate-fade-in" />

      <div className="w-full max-w-md z-10 animate-slide-up">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-950/50 rounded-2xl border border-indigo-500/20 mb-4">
            <Shield className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
            <Cpu className="w-7 h-7 text-indigo-400" />
            SmartHome <span className="text-indigo-400">Cloud</span>
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            {isSignUp ? 'Create your administrator account' : 'Sign in to access your dashboard'}
          </p>
        </div>

        {/* Auth Glassmorphic Card */}
        <div className="glass rounded-2xl p-6 sm:p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                className="w-full px-4 py-3.5 bg-slate-950/80 border border-slate-800/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-sm"
                placeholder="you@domain.com"
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full px-4 py-3.5 bg-slate-950/80 border border-slate-800/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-sm"
                placeholder="••••••••"
              />
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3.5 bg-red-950/30 border border-red-500/20 text-red-300 rounded-xl text-sm font-medium animate-slide-up">
                {errorMessage}
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="p-3.5 bg-emerald-950/30 border border-emerald-500/20 text-emerald-300 rounded-xl text-sm font-medium animate-slide-up">
                {successMessage}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg hover:shadow-indigo-500/20 active:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer tap-highlight-none active-press touch-target text-sm"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </>
              )}
            </button>
          </form>

          {/* Toggle link */}
          <div className="mt-6 text-center text-sm">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer tap-highlight-none"
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
