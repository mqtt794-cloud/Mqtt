/**
 * =============================================================================
 * src/app/oauth/authorize/page.tsx — OAuth Authorization Endpoint
 * =============================================================================
 *
 * PATH:
 *   GET /oauth/authorize
 *
 * PURPOSE:
 *   Server-side shell page wrapping the AuthorizeForm Client Component.
 *   Uses Suspense to safely load query string parameters via Next.js
 *   useSearchParams hook during run-time execution.
 * =============================================================================
 */

import { Suspense } from 'react';
import AuthorizeForm from './AuthorizeForm';

export default function AuthorizePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center font-semibold tracking-wide">
          Loading Authorization...
        </div>
      }
    >
      <AuthorizeForm />
    </Suspense>
  );
}
