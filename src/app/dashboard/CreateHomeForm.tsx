/**
 * =============================================================================
 * CreateHomeForm.tsx — Create Home Client Component
 * =============================================================================
 */

'use client';

import { useState } from 'react';
import { createHome } from './actions';
import { Home } from 'lucide-react';

export default function CreateHomeForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const name = formData.get('name') as string;

    try {
      const res = await createHome(name);
      if (res?.error) {
        setError(res.error);
      } else {
        event.currentTarget.reset();
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Home className="w-5 h-5 text-emerald-400" />
        Create a New Home
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Home Name (e.g. Vacation Cabin)
          </label>
          <input
            name="name"
            type="text"
            required
            placeholder="Enter home location name"
            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {error && (
          <div className="p-3 bg-red-950/30 border border-red-500/20 text-red-400 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl active:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center cursor-pointer"
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            'Add Home Location'
          )}
        </button>
      </form>
    </div>
  );
}
